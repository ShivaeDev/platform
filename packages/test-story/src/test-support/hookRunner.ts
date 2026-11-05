import { Effect } from "effect";
import { hooked } from "#server/hooked.ts";
import { storyKit } from "#server/storyKit.ts";
import { attempt } from "./attempt.ts";

export const hookRunner = storyKit({
	create: () => ({ calls: 0 }),
	name: "hook runner",
	stages: [],
	verbs: (state, story) => {
		const deferred = hooked(() => {
			state.calls += 1;
			return Effect.succeed(42);
		});
		return {
			calls: () => state.calls,
			runs: () => {
				story.tell("the story runs the deferred hook");
				return deferred;
			},
			runsInterruptedHook: () => {
				story.tell("the story runs a hook returning an interruption");
				return attempt(hooked(() => Effect.interrupt));
			},
			runsRefusingHook: () => {
				story.tell("the story runs a hook returning a typed failure");
				return attempt(hooked(() => Effect.fail("engine refused")));
			},
		};
	},
});
