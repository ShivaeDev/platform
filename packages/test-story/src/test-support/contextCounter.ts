import { Context } from "effect";
import { storyKit } from "#server/storyKit.ts";

class RunningCounter extends Context.Service<RunningCounter, { count: number }>()("@shivaedev/test-story/restarts/RunningCounter") {}

export const contextCounter = storyKit({
	after: { built: (engine: { count: number }) => Context.make(RunningCounter, engine) },
	create: () => ({ count: 0 }),
	name: "context counter",
	run: {
		maxSteps: 1,
		*step() {
			const engine = yield* RunningCounter;
			engine.count += 1;
		},
	},
	stages: ["built"],
	verbs: (engine, story) => ({
		advance: () => {
			const next = engine.count + 1;
			return story.runUntil((current) => current.count === next);
		},
		count: () => engine.count,
	}),
});

export function startsAt(count: number) {
	return contextCounter.trait("built", `the counter starts at ${count}`, (engine) => {
		engine.count = count;
	});
}
