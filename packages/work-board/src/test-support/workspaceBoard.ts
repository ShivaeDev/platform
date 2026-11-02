import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer, type PlatformError } from "effect";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { DiagnosticsConfig, SourceFailure } from "#diagnostics/source.ts";
import { workRpcs } from "#rpc/contract.ts";
import { boardServices } from "#server/boardServices.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { watchIndex } from "#server/search/watchIndex.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { workspaceFiles } from "./workspaceFiles.ts";
import { workspaceFleet } from "./workspaceFleet.ts";

export class BoardWorkspace extends Context.Service<
	BoardWorkspace,
	{
		readonly paths: () => readonly string[];
		readonly synchronize: Effect.Effect<void, PlatformError.PlatformError>;
	}
>()("Test/BoardWorkspace") {}

const missing = Effect.fail(new SourceFailure({ kind: "not-configured", message: "Source missing" }));

export function workspaceBoard(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const notes = yield* workspaceFiles(files, options);
			const fleetPort = yield* workspaceFleet(notes, files, options);
			const home = options && "home" in options ? options.home : Object.keys(files)[0];
			const index = yield* watchIndex(notes.root, home);
			yield* index.read;
			const services = boardServices({ fleetPort }).pipe(
				Layer.provide(Workspace.layer),
				Layer.provide([
					Layer.succeed(WorkspaceConfig, {
						changes: index.changes,
						home,
						index: index.read,
						pullRequests: Effect.succeed(options?.pullRequests),
						root: notes.root,
						writable: options?.writable === true,
					}),
					Layer.succeed(DiagnosticsConfig, {
						_tag: "Sources",
						sources: { codex: missing, fleet: options?.fleetHealth ? Effect.succeed(options.fleetHealth) : missing, github: missing },
					}),
					Highlighter.layer,
				]),
			);
			return hostChanges(workRpcs).pipe(
				Layer.provideMerge(services),
				Layer.merge(
					Layer.succeed(BoardWorkspace, {
						paths: notes.paths,
						synchronize: notes.synchronize.pipe(Effect.andThen(index.reconcile)),
					}),
				),
			);
		}),
	).pipe(Layer.provide(NodeServices.layer));
}
