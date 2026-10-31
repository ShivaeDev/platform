import { Effect, Option, Result, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { changesUntil, type EventStream, rpcWatcher } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function nativeVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		changed: (events: EventStream, path: string) => {
			tell(`the reader waits for a live change naming ${path}`);
			return changesUntil(events, path);
		},
		changeWasAnnounced: (path: string) => {
			tell(`the reader observes whether the server announced a change to ${path}`);
			if (!engine.announcedChanges) {
				throw new Error("Announced changes are not observed");
			}
			return engine.announcedChanges.some((paths) => paths.includes(path));
		},
		changeWasDropped: () => {
			tell("the reader observes whether live delivery lost a change");
			if (!engine.changeDelivery) {
				throw new Error("No delivery fault was prepared");
			}
			return engine.changeDelivery.dropped;
		},
		disconnectTransport: () => {
			tell("the native HTTP connection goes offline");
			if (!engine.connectionBoundary) {
				throw new Error("No native connection boundary was prepared");
			}
			engine.connectionBoundary.disconnect();
		},
		loseNextChange: () => {
			tell("the live delivery boundary drops the next server change");
			if (!engine.changeDelivery) {
				throw new Error("No delivery fault was prepared");
			}
			engine.changeDelivery.loseNext = true;
		},
		mountedRead: Effect.fn("Story.mountedRead")(function* <A, E>(query: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
			tell("the reader mounts a live query and reads it");
			const client = served(engine).client;
			yield* Effect.acquireRelease(
				Effect.sync(() => client.registry.mount(query)),
				(release) => Effect.sync(release),
			);
			return yield* Effect.promise(() => client.read(query));
		}),
		nextRead: <A, E>(query: Atom.Atom<AsyncResult.AsyncResult<A, E>>, previous: A) => {
			tell("the reader waits for its mounted query to show a new read");
			const before = JSON.stringify(previous);
			return AtomRegistry.toStream(served(engine).client.registry, query).pipe(
				Stream.filterMap((result) =>
					AsyncResult.isSuccess(result) && !result.waiting && JSON.stringify(result.value) !== before
						? Result.succeed(result.value)
						: Result.failVoid,
				),
				Stream.runHead,
				Effect.flatMap((read) => Option.match(read, { onNone: () => Effect.die(new Error("The mounted query stopped")), onSome: Effect.succeed })),
			);
		},
		omitNextPath: (path: string) => {
			tell(`the next live message omits the observed edit to ${path}`);
			if (!engine.changeDelivery) {
				throw new Error("No delivery fault was prepared");
			}
			engine.changeDelivery.omitPath = path;
		},
		resumeTransport: () => {
			tell("the native HTTP connection returns");
			if (!engine.connectionBoundary) {
				throw new Error("No native connection boundary was prepared");
			}
			engine.connectionBoundary.resume();
		},
		waitForConnection: (state: "live" | "reconnecting" = "live") => {
			tell(`the reader waits for its native connection to be ${state}`);
			const client = served(engine).client;
			return AtomRegistry.toStream(client.registry, client.updates.status).pipe(
				Stream.takeUntil((status) => status.connection === state),
				Stream.runDrain,
			);
		},
		watchingReady: Effect.fn("Story.watchingReady")(function* (events: EventStream) {
			tell("the reader waits for the watcher to recover");
			for (;;) {
				yield* events.next();
				if ((yield* rpcWatcher(served(engine).board)).watching) {
					return;
				}
			}
		}),
	};
}
