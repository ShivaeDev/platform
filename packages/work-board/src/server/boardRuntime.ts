import { Context, Effect, FileSystem, Layer, Path, type PlatformError, Schedule, Stream, SubscriptionRef } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { DiagnosticsConfig, DiagnosticsSources } from "#diagnostics/source.ts";
import type { Indexing } from "#rpc/Indexing.ts";
import { index as indexKeys } from "#rpc/keys.ts";
import type { BoardOptions } from "#server/board.ts";
import { boardServices } from "#server/boardServices.ts";
import { daemonDiagnostics } from "#server/diagnostics/daemon.ts";
import { watchChanges } from "#server/files/changes.ts";
import { homeIn } from "#server/files/home.ts";
import { repositoryPulls } from "#server/files/repository.ts";
import { checkBrowserAssets, mermaidRoot } from "#server/http/assets.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { HandlerOptions } from "#server/rpc/HandlerOptions.ts";
import { publishChanges } from "#server/rpc/publishChanges.ts";
import { type Snapshot, searchSnapshot } from "#server/search/snapshot.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";

export const boardRuntime = Effect.fn("WorkBoard.boardRuntime")(function* (options: BoardOptions, server?: HandlerOptions["server"]) {
	const home = yield* homeIn(options.root, options.home);
	const mermaid = yield* mermaidRoot();
	yield* checkBrowserAssets();
	const changes = yield* watchChanges(options.root);
	const liveContext = yield* Layer.build(Layer.effect(AppChanges, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer)));
	const live = Layer.succeedContext(liveContext);
	const path = yield* Path.Path;
	const fleetFolder = path.relative(path.resolve(), options.root) || ".";
	const platform = (yield* Effect.context<Highlighter | FileSystem.FileSystem | Path.Path>()).pipe(
		Context.pick(Highlighter, FileSystem.FileSystem, Path.Path),
	);
	const pullRequests = yield* Effect.cached(Effect.provideContext(repositoryPulls(options.root), platform));
	const indexing = yield* SubscriptionRef.make<Indexing | undefined>(undefined);
	const index: Effect.Effect<Snapshot, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> = yield* searchSnapshot(
		options.root,
		home,
		changes,
		options.maintainer,
		indexing,
	);

	yield* SubscriptionRef.changes(indexing).pipe(
		Stream.runForEach(() => Context.get(liveContext, Reactivity.Reactivity).invalidate(invalidationKeys([indexKeys.item("progress")]))),
		Effect.forkScoped,
	);
	yield* Effect.forkScoped(
		index.pipe(
			Effect.tapError((error) => Effect.logDebug("The startup index failed; the next read rebuilds it", error)),
			Effect.ignore,
			// The repository lookup reads outside the workspace, so it waits until the startup index no longer needs the file reads.
			Effect.andThen(pullRequests),
		),
	);
	yield* index.pipe(Effect.ignore, Effect.repeat(Schedule.spaced("1 hour")), Effect.forkScoped);
	const provided = yield* Effect.serviceOption(DiagnosticsSources);
	const services = yield* Layer.build(
		boardServices({
			fleetFolder,
			...(options.fleetPort === undefined ? {} : { fleetPort: options.fleetPort }),
			...(server === undefined ? {} : { server }),
		}).pipe(
			Layer.provideMerge(Workspace.layer),
			Layer.provide([
				Layer.succeed(WorkspaceConfig, {
					changes,
					fleetPort: options.fleetPort,
					home,
					index: Effect.provideContext(index, platform),
					indexing: SubscriptionRef.get(indexing),
					pullRequests,
					root: options.root,
					writable: options.responses === true,
				}),
				Layer.succeed(
					DiagnosticsConfig,
					provided._tag === "Some"
						? { _tag: "Sources", sources: provided.value }
						: { _tag: "Read", read: daemonDiagnostics(fleetFolder, options.fleetPort) },
				),
			]),
		),
	);
	const context = Context.merge(platform, services);
	yield* publishChanges.pipe(Effect.provideContext(Context.merge(liveContext, context)), Effect.forkScoped);
	return { changes, context, home, index, live, mermaid, rpcHandlers: Layer.succeedContext(services).pipe(Layer.provideMerge(live)) };
});
