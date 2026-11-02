import { Data, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { answered } from "#answers.ts";
import { withLive } from "#withLive.ts";
import { clockReading } from "./clockReading.ts";

class NotReady extends Data.TaggedError("NotReady")<{ readonly message: string }> {}

interface LiveRegionEngine {
	answer: unknown;
	realWaitMillis: number;
	regionClock: string | undefined;
}

export const liveRegion = storyKit({
	create: (): LiveRegionEngine => ({ answer: undefined, realWaitMillis: 0, regionClock: undefined }),
	inspect: (engine) => engine,
	name: "live region",
	stages: [],
	verbs: (engine, story) => ({
		answer: () => Effect.sync(() => engine.answer),
		clock: () => clockReading,
		clockInRegion: () => Effect.sync(() => engine.regionClock),
		realWaitMillis: () => Effect.sync(() => engine.realWaitMillis),
		runsLiveRegion: (ending: "succeeds" | "fails") => {
			story.tell(`a live region reads its clock and ${ending}`);
			const region = Effect.gen(function* () {
				engine.regionClock = yield* clockReading;
				return ending === "succeeds" ? "ready" : yield* new NotReady({ message: "not ready" });
			});
			return Effect.map(answered(withLive(region)), (answer) => {
				engine.answer = answer;
			});
		},
		waitsInLiveTime: () => {
			story.tell("a live region sleeps for 30 milliseconds");
			return Effect.gen(function* () {
				const started = performance.now();
				yield* withLive(Effect.sleep("30 millis"));
				engine.realWaitMillis = performance.now() - started;
			});
		},
	}),
});
