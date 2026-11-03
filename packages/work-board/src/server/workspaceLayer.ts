import { Effect, Layer } from "effect";
import { homeIn } from "#server/files/home.ts";
import { watchIndex } from "#server/search/watchIndex.ts";
import { Workspace, WorkspaceConfig, type WorkspaceOptions } from "#server/workspace.ts";

export interface HeadlessWorkspaceOptions extends Omit<WorkspaceOptions, "changes" | "index" | "indexing" | "writable"> {
	readonly maintainer?: string;
	readonly writable?: boolean;
}

export function workspaceLayer(options: HeadlessWorkspaceOptions) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const owner = yield* Effect.context<never>();
			const home = yield* homeIn(options.root, options.home);
			const { changes, read } = yield* watchIndex(options.root, home, options.maintainer);
			return Workspace.layer.pipe(
				Layer.provide(
					Layer.succeed(WorkspaceConfig, {
						...options,
						changes,
						home,
						index: read.pipe(Effect.updateContext<never, never>(() => owner)),
						writable: options.writable === true,
					}),
				),
			);
		}),
	);
}
