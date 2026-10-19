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
