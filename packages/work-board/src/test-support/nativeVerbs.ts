import { Effect, Option } from "effect";
import { waitFor } from "./live.ts";
import { changesUntil, type EventStream, rpcDocument, rpcSearch, rpcWatcher } from "./nativeRpc.ts";
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
		searchFinds: (query: string, path: string) => {
			tell(`the reader checks search for ${path}`);
			return Effect.map(rpcSearch(served(engine).board, query), (found) => JSON.stringify(found).includes(path));
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
		watchedDocumentShows: Effect.fn("Story.watchedDocumentShows")(function* (url: string, text: string) {
			tell(`the reader checks the watched document ${url}`);
			const board = served(engine).board;
			const read = yield* Effect.option(rpcDocument(board, url));
			return (yield* rpcWatcher(board)).watching && Option.isSome(read) && read.value.source.includes(text);
		}),
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
