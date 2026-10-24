import { Effect } from "effect";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { startHostDaemon } from "#test/startHostDaemon.ts";

export function watchScheduler(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		readerRecord: (workId: string) => {
			if (engine.reader === undefined) {
				return Effect.die("Start the read daemon before reading it");
			}
			return engine.reader.client("fleet.get", { workId });
		},
		reviewHeads: () => engine.reviews,
		startReader: () =>
			Effect.gen(function* () {
				tell("start a separate read daemon for the watches");
				const parts = engine.runningParts;
				if (parts === undefined) {
					return yield* Effect.die("Start the scheduler before the read daemon");
				}
				engine.reader = yield* startHostDaemon(readDaemonLayer(engine.fixture.host, { parts }));
				return engine.reader.port;
			}),
	};
}
