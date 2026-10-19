import { Effect } from "effect";
import { waitFor } from "./live.ts";
import { changesUntil, type EventStream, rpcWatcher } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function nativeVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		changed: (events: EventStream, path: string) => {
			tell(`the reader waits for a live change naming ${path}`);
			return changesUntil(events, path);
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
		waitForConnection: () => {
			tell("the reader waits for its native live connection");
			const client = served(engine).client;
			return Effect.promise(() =>
				waitFor(() => {
					if (client.registry.get(client.updates.status).connection !== "live") {
						throw new Error("The native connection is not live yet");
					}
				}),
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
