import { Context, Effect, FileSystem, Path, type PlatformError, Semaphore } from "effect";
import { type BadRequest, Forbidden, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import type { Document } from "#browser/document/schema.ts";
import type { Indexing } from "#rpc/Indexing.ts";
import { loadSettled } from "#server/archive/loadSettled.ts";
import { readDocument } from "#server/document/read.ts";
import type { Changes } from "#server/files/changes.ts";
import { refreshWritten } from "#server/files/changes.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { closeDecision, metadataValues, patchMetadata } from "#server/metadata/adapters/frontmatter.ts";
import { metadataParse } from "#server/metadata/adapters/parse.ts";
import { Publication, replaceIfUnchanged } from "#server/publication.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export interface WorkspaceOptions {
	readonly changes: Changes;
	readonly fleetPort?: number | null | undefined;
	readonly home?: string | undefined;
	readonly index: Effect.Effect<Snapshot, PlatformError.PlatformError>;
	readonly indexing?: Effect.Effect<Indexing | undefined> | undefined;
	readonly pullRequests?: Effect.Effect<string | undefined> | undefined;
	readonly root: string;
	readonly writable: boolean;
}

export interface WorkspaceSettings extends Omit<WorkspaceOptions, "index"> {
	readonly realRoot: string;
}

export class WorkspaceConfig extends Context.Service<WorkspaceConfig, WorkspaceOptions>()("@shivaedev/work-board/WorkspaceConfig") {}

export interface MetadataWrite {
	readonly fields: Readonly<Record<string, unknown>>;
	readonly file: string;
	readonly source: string;
}

export interface DecisionClose {
	readonly file: string;
	readonly nextAction?: string;
	readonly request: string;
	readonly source: string;
}

const workspaceMetadata = Effect.gen(function* () {
	const options = yield* WorkspaceConfig;
	const lock = yield* Semaphore.make(1);
	const { root, changes, writable } = options;
	const realRoot = changes.realRoot;
	const pathOf = Effect.fn("WorkBoard.pathOf")(function* (file: string) {
		const path = yield* markdownPath(root, realRoot, file);
		return path ?? (yield* Effect.fail(new NotFound({ message: "The Markdown source is missing." })));
	});
	const metadata = Effect.fn("WorkBoard.metadata")(function* (file: string) {
		const fs = yield* FileSystem.FileSystem;
		const source = new TextDecoder("utf-8", { "ignoreBOM": true }).decode(yield* fs.readFile(yield* pathOf(file)));
		const values = yield* metadataValues(source);
		return { file, parsed: metadataParse(source), source, values };
	});
	const write = Effect.fn("WorkBoard.write")(function* (file: string, source: string, content: Effect.Effect<string, BadRequest>) {
		if (!writable) {
			return yield* Effect.fail(new Forbidden({ message: "Enable workspace writes explicitly with writable: true." }));
		}
		yield* pathOf(file);
		const next = yield* content;
		const values = yield* metadataValues(next);
		yield* replaceIfUnchanged({ content: next, expectedSource: source, path: file, realRoot, root }).pipe(
			Effect.provide(Publication.layer),
			Effect.ensuring(refreshWritten(changes, [file])),
		);
		return { file, parsed: metadataParse(next), source: next, values };
	});
	return {
		closeDecision: (input: DecisionClose) =>
			lock.withPermit(write(input.file, input.source, closeDecision(input.source, input.request, input.nextAction))),
		metadata,
		writeMetadata: (input: MetadataWrite) => lock.withPermit(write(input.file, input.source, patchMetadata(input.source, input.fields))),
	};
});

export const Workspace = defineService({
	id: "@shivaedev/work-board/Workspace",
	initialize: Effect.gen(function* () {
		const options = yield* WorkspaceConfig;
		return { metadata: yield* workspaceMetadata, options };
	}),
	methods: ({ options: { index, ...options }, metadata }) => {
		const settings = { ...options, realRoot: options.changes.realRoot };
		const read = readDocument(settings);
		function document(url: string): Effect.Effect<Document, Effect.Error<ReturnType<typeof read>>, Effect.Services<ReturnType<typeof read>>> {
			return Effect.flatMap(index, (snapshot) => read(url, snapshot));
		}
		return {
			...metadata,
			archived: (selection: string) => Effect.flatMap(index, (snapshot) => loadSettled(options.root, snapshot, selection)),
			document,
			index: () => index,
			settings: () => Effect.succeed(settings),
		};
	},
	requires: [WorkspaceConfig, FileSystem.FileSystem, Path.Path],
});
export type Workspace = typeof Workspace.Identifier;
