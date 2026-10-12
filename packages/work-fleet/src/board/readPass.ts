import { join } from "node:path";
import { Context, Effect, type FileSystem, type Path } from "effect";
import { board as boardApi } from "@shivaedev/work-board/integration/board.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardFailure, BoardWork } from "#policy.ts";

const { metadataModel } = boardApi;

export class BoardSnapshot {
	documents: readonly BoardDocument[];
	model: ReturnType<typeof metadataModel>;
	files: ReadonlyMap<string, BoardDocument>;
	readonly problems: Map<string, BoardFailure>;

	constructor(documents: readonly BoardDocument[], problems: Map<string, BoardFailure> = new Map()) {
		this.problems = problems;
		this.documents = documents;
		this.model = metadataModel(documents);
		this.files = new Map(documents.map((document) => [document.file, document]));
	}

	record(document: BoardDocument) {
		this.problems.delete(document.file);
		this.documents = [...this.documents.filter((entry) => entry.file !== document.file), document];
		this.model = metadataModel(this.documents);
		this.files = new Map(this.documents.map((entry) => [entry.file, entry]));
	}
}

type Read = Effect.Effect<BoardSnapshot, BoardFailure>;
interface Pass {
	active: boolean;
	readonly publications: Set<Effect.Effect<void>>;
	readonly reads: Map<string, Read>;
}
const ReadPass = Context.Reference<Pass | undefined>("@shivaedev/work-fleet/board/ReadPass", { defaultValue: () => undefined });

export function withBoardReadPass<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.suspend(() => {
		const pass: Pass = { active: true, publications: new Set(), reads: new Map() };
		return effect.pipe(
			Effect.provideService(ReadPass, pass),
			Effect.ensuring(
				Effect.gen(function* () {
					pass.active = false;
					for (const publication of pass.publications) {
						yield* publication;
					}
				}),
			),
		);
	});
}

export const inBoardReadPass = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	return yield* (yield* ReadPass)?.active === true ? effect : withBoardReadPass(effect);
});

export const readSnapshot = Effect.fn("FleetBoard.readSnapshot")(function* (
	realRoot: string,
	read: Effect.Effect<BoardSnapshot, BoardFailure, FileSystem.FileSystem | Path.Path>,
) {
	const pass = yield* ReadPass;
	if (pass?.active !== true) {
		return yield* read;
	}
	let cached = pass.reads.get(realRoot);
	if (cached === undefined) {
		const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
		const next = yield* Effect.cached(read.pipe(Effect.provideContext(services)));
		cached = pass.reads.get(realRoot) ?? next;
		pass.reads.set(realRoot, cached);
	}
	return yield* cached;
});

export const recordBoardSource = Effect.fn("FleetBoard.recordBoardSource")(function* (
	realRoot: string,
	file: string,
	source: string,
	parsed?: ReturnType<typeof boardApi.metadataParse>,
) {
	const pass = yield* ReadPass;
	const read = pass?.active === true ? pass.reads.get(realRoot) : undefined;
	if (read !== undefined) {
		const snapshot = yield* read;
		const existing = snapshot.files.get(file);
		if (existing?.source !== source) {
			snapshot.record({ file, parsed: parsed ?? boardApi.metadataParse(source), source });
		}
	}
});

export const workMetadata = Effect.fn("FleetBoard.workMetadata")(function* (work: BoardWork) {
	const pass = yield* ReadPass;
	for (const [root, read] of pass?.active === true ? pass.reads : []) {
		const snapshot = yield* read;
		const matches = snapshot.model.ids.get(work.workId);
		const document = matches?.length === 1 ? snapshot.files.get(matches[0]?.file ?? "") : undefined;
		if (document?.source === work.context && join(root, document.file) === work.sourcePath) {
			return document.parsed;
		}
	}
	return boardApi.metadataParse(work.context);
});

export const publishAfterBoardPass = Effect.fn("FleetBoard.publishAfterBoardPass")(function* (publication: Effect.Effect<void>) {
	const pass = yield* ReadPass;
	if (pass?.active === true) {
		pass.publications.add(publication);
	} else {
		yield* publication;
	}
});
