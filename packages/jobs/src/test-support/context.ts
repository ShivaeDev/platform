import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { jobContext } from "#server/definition.ts";
import { job } from "#test/fakeClient.ts";

export const context = storyKit({
	clock: "test",
	create: () => Effect.succeed(jobContext(job("budget", {}), 2000)),
	name: "job context with a 2000ms deadline",
	stages: [],
	verbs: (engine, story) => ({
		clockPasses: (millis: number) => {
			story.tell(`${millis}ms pass on the job clock`);
			return TestClock.adjust(millis);
		},
		remainingBudget: () => engine.remainingBudget,
	}),
});
