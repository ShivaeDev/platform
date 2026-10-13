import { Context, Effect, FileSystem, Layer, Path, type PlatformError } from "effect";
import { DiagnosticsSources } from "#diagnostics/source.ts";
import type { BoardOptions } from "#server/board.ts";
import { boardServices } from "#server/boardServices.ts";
import { daemonDiagnostics } from "#server/diagnostics/daemon.ts";
import { readDocument } from "#server/document/read.ts";
import { watchChanges } from "#server/files/changes.ts";
import { homeIn } from "#server/files/home.ts";
import { checkBrowserAssets, mermaidRoot } from "#server/http/assets.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { handlers } from "#server/rpc/handlers.ts";
import { type Snapshot, searchSnapshot } from "#server/search/snapshot.ts";

export const boardRuntime = Effect.fn("WorkBoard.boardRuntime")(function* (options: BoardOptions) {
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
	const provided = yield* Effect.serviceOption(DiagnosticsSources);
	const services = yield* Layer.build(
		boardServices(
			{ changes, enabled: options.responses === true, index: Effect.provideContext(index, platform), root: options.root },
			provided._tag === "Some" ? { _tag: "Sources", sources: provided.value } : { _tag: "Read", read: daemonDiagnostics(options.fleetPort) },
		),
	);
	const context = Context.merge(platform, services);
	const rpcHandlers = yield* handlers({
		changes,
		document: (url) =>
			Effect.provideContext(
				readDocument({
					changes,
					home,
					index: Effect.provideContext(index, context),
					root: options.root,
					writable: options.responses === true,
				})(url),
				context,
			),
		home,
		index: Effect.provideContext(index, context),
		writable: options.responses === true,
	}).pipe(Effect.provideContext(context));
	return { changes, context, home, index, mermaid, rpcHandlers };
});
