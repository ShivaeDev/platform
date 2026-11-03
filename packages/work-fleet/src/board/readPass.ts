import { join } from "node:path";
import { Context, Effect, type FileSystem, type Path, type Scope } from "effect";
import type { ParsedMetadata } from "@shivaedev/work-board/integration/metadata.ts";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import type { Snapshot as BoardSnapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import { BoardIndex } from "#board/Index.ts";
import { warnSnapshotProblems } from "#board/warnSnapshotProblems.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";

type Read = Effect.Effect<BoardSnapshot, BoardFailure>;

function incompleteObservation(root: string, error: { readonly message: string }) {
	return new BoardFailure({ code: "incomplete-observation", message: `Board sources could not be read: ${root} (${error.message})` });
}

interface Pass {
	active: boolean;
	readonly fresh: boolean;
	readonly publications: Set<Effect.Effect<void>>;
	readonly reads: Map<string, Read>;
}
const ReadPass = Context.Reference<Pass | undefined>("@shivaedev/work-fleet/board/ReadPass", { defaultValue: () => undefined });

export function withBoardReadPass<A, E, R>(effect: Effect.Effect<A, E, R>, options?: { readonly fresh?: boolean }) {
	return Effect.suspend(() => {
		const pass: Pass = { active: true, fresh: options?.fresh === true, publications: new Set(), reads: new Map() };
		return effect.pipe(
			Effect.provideService(ReadPass, pass),
			Effect.ensuring(
				Effect.gen(function* () {
					pass.active = false;
					// Worker contexts can outlive the pass that owns these snapshots.
					pass.reads.clear();
					const publications = [...pass.publications];
					pass.publications.clear();
					for (const publication of publications) {
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
	const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
	const watched = yield* Effect.serviceOption(BoardIndex);
	const refresh =
		(pass?.active !== true || pass.fresh) && watched._tag === "Some"
			? watched.value.index.reconcile.pipe(Effect.mapError((error) => incompleteObservation(realRoot, error)))
			: Effect.void;
	const shared = Effect.andThen(refresh, read).pipe(
		Effect.tap((snapshot) => warnSnapshotProblems(realRoot, snapshot)),
		Effect.provideContext(services),
	);
	if (pass?.active !== true) {
		return yield* shared;
	}
	let cached = pass.reads.get(realRoot);
	if (cached === undefined) {
		const next = yield* Effect.cached(shared);
		cached = pass.reads.get(realRoot) ?? next;
		pass.reads.set(realRoot, cached);
	}
	return yield* cached;
});

export const recordBoardWrite = Effect.fn("FleetBoard.recordBoardWrite")(function* (realRoot: string, file: string) {
	const watched = yield* Effect.serviceOption(BoardIndex);
	if (watched._tag === "Some") {
		yield* watched.value.index.changes.refreshPaths?.([file]) ?? Effect.void;
	}
	const pass = yield* ReadPass;
	const read = pass?.active === true ? pass.reads.get(realRoot) : undefined;
	if (read !== undefined && watched._tag === "Some") {
		const next = yield* Effect.cached(watched.value.index.read.pipe(Effect.mapError((error) => new BoardFailure({ message: error.message }))));
		pass?.reads.set(realRoot, next);
	}
});

export const workMetadata = Effect.fn("FleetBoard.workMetadata")(function* (work: BoardWork): Effect.fn.Return<ParsedMetadata, BoardFailure> {
	const pass = yield* ReadPass;
	for (const [root, read] of pass?.active === true ? pass.reads : []) {
		const snapshot = yield* read;
		const matches = snapshot.model.ids.get(work.workId);
		const document = matches?.length === 1 ? snapshot.documents.find((entry) => entry.file === matches[0]?.file) : undefined;
		if (
			document !== undefined
			&& (document.parsed.raw ?? "") + document.parsed.body === work.context
			&& join(root, document.file) === work.sourcePath
		) {
			return document.parsed;
		}
	}
	return boardApi.metadataParse(work.context);
});

export const publishAfterBoardPass = Effect.fn("FleetBoard.publishAfterBoardPass")(function* (
	publication: Effect.Effect<void>,
	backgroundScope?: Scope.Scope,
	backgroundPublication: Effect.Effect<void> = publication,
) {
	const pass = yield* ReadPass;
	if (pass?.active === true) {
		pass.publications.add(publication);
	} else if (backgroundScope === undefined) {
		yield* publication;
	} else {
		yield* backgroundPublication.pipe(Effect.forkIn(backgroundScope));
	}
});
