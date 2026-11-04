import { Clock, DateTime, Effect } from "effect";
import { storyKit } from "#server/storyKit.ts";

function readsClock(hook: string) {
	return Clock.currentTimeMillis.pipe(Effect.map((millis) => `${hook} on ${millis === 0 ? "the test clock at zero" : "the pinned clock"}`));
}

export const pinnedKit = storyKit({
	after: {
		*built(engine) {
			engine.readings.push(yield* readsClock("after"));
		},
	},
	clock: DateTime.makeUnsafe("2026-10-17T12:34:56.000Z"),
	*create() {
		return { readings: [yield* readsClock("create")], steps: 0 };
	},
	name: "pinned kit",
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
