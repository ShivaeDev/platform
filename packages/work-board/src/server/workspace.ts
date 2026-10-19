import { Context, Effect, FileSystem, Path, type PlatformError, type Stream } from "effect";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import type { Document } from "#browser/document/schema.ts";
import type { Indexing } from "#rpc/Indexing.ts";
import { readDocument } from "#server/document/read.ts";
import type { Changes } from "#server/files/changes.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export interface WorkspaceOptions {
	readonly changes: Changes;
	readonly home?: string | undefined;
	readonly index: Effect.Effect<Snapshot, PlatformError.PlatformError>;
	readonly indexing?: Stream.Stream<Indexing | undefined> | undefined;
	readonly pullRequests?: string | undefined;
	readonly root: string;
	readonly writable: boolean;
}

export interface WorkspaceSettings extends Omit<WorkspaceOptions, "index"> {
	readonly realRoot: string;
}

export class WorkspaceConfig extends Context.Service<WorkspaceConfig, WorkspaceOptions>()("WorkBoard/WorkspaceConfig") {}

export const Workspace = defineService({
	id: "WorkBoard/Workspace",
	initialize: Effect.gen(function* () {
		return yield* WorkspaceConfig;
	}),
	methods: ({ index, ...options }) => {
		const settings = { ...options, realRoot: options.changes.realRoot };
		const read = readDocument(settings);
		function document(url: string): Effect.Effect<Document, Effect.Error<ReturnType<typeof read>>, Effect.Services<ReturnType<typeof read>>> {
			return Effect.flatMap(index, (snapshot) => read(url, snapshot));
		}
		return {
			document,
			index: () => index,
			settings: () => Effect.succeed(settings),
		};
	},
	requires: [WorkspaceConfig, FileSystem.FileSystem, Path.Path],
});
export type Workspace = typeof Workspace.Identifier;
