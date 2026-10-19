import { Context, Effect, FileSystem, Layer, Path, type PlatformError } from "effect";
import { DiagnosticsConfig, DiagnosticsSources } from "#diagnostics/source.ts";
import type { BoardOptions } from "#server/board.ts";
import { boardServices } from "#server/boardServices.ts";
import { daemonDiagnostics } from "#server/diagnostics/daemon.ts";
import { watchChanges } from "#server/files/changes.ts";
import { homeIn } from "#server/files/home.ts";
import { checkBrowserAssets, mermaidRoot } from "#server/http/assets.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { HandlerOptions } from "#server/rpc/HandlerOptions.ts";
import { type Snapshot, searchSnapshot } from "#server/search/snapshot.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";

export const boardRuntime = Effect.fn("WorkBoard.boardRuntime")(function* (options: BoardOptions, server?: HandlerOptions["server"]) {
	const home = yield* homeIn(options.root, options.home);
	const mermaid = yield* mermaidRoot();
	yield* checkBrowserAssets();
	const changes = yield* watchChanges(options.root);
	const platform = (yield* Effect.context<Highlighter | FileSystem.FileSystem | Path.Path>()).pipe(
		Context.pick(Highlighter, FileSystem.FileSystem, Path.Path),
	);
	const index: Effect.Effect<Snapshot, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> = yield* searchSnapshot(
		options.root,
		home,
		changes,
		options.maintainer,
	);
	yield* Effect.forkScoped(
		index.pipe(
			Effect.tapError((error) => Effect.logDebug("The startup index failed; the next read rebuilds it", error)),
			Effect.ignore,
		),
	);
	const provided = yield* Effect.serviceOption(DiagnosticsSources);
	const services = yield* Layer.build(
		boardServices({
			...(options.fleetPort === undefined ? {} : { fleetPort: options.fleetPort }),
			...(server === undefined ? {} : { server }),
		}).pipe(
			Layer.provideMerge(Workspace.layer),
			Layer.provide([
				Layer.succeed(WorkspaceConfig, {
					changes,
					home,
					index: Effect.provideContext(index, platform),
					root: options.root,
					writable: options.responses === true,
				}),
				Layer.succeed(
					DiagnosticsConfig,
					provided._tag === "Some"
						? { _tag: "Sources", sources: provided.value }
						: { _tag: "Read", read: daemonDiagnostics(options.root, options.fleetPort) },
				),
			]),
		),
	);
	const context = Context.merge(platform, services);
	return { changes, context, home, index, mermaid, rpcHandlers: Layer.succeedContext(services) };
});
