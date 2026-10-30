import { Clock, Effect } from "effect";
import { storyKit } from "#storyKit.ts";

function readsClock(hook: string) {
	return Clock.currentTimeMillis.pipe(Effect.map((millis) => `${hook} on ${millis === 0 ? "the test clock at zero" : "the live clock"}`));
}

export const liveKit = storyKit({
	after: {
		*built(engine) {
			engine.readings.push(yield* readsClock("after"));
		},
	},
	clock: "live",
	*create() {
		return { readings: [yield* readsClock("create")], steps: 0 };
	},
	name: "live kit",
	run: {
		maxSteps: 1,
		*step(engine) {
			engine.readings.push(yield* readsClock("step"));
			engine.steps += 1;
		},
	},
	stages: ["built"],
	verbs: (engine, story) => ({
		clockReadings: () => [...engine.readings],
		stepsOnce: () => story.runUntil((current) => current.steps === 1),
	}),
});
