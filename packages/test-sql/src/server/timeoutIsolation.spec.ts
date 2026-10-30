import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRunner } from "#test/vitestRunner.ts";

vitestRunner.it(
	"a story that times out closes its isolated database before the next story sets up its own, with no uncaught errors",
	[],
	function* ({ runTimeoutStories, timeoutStoryOutcome, workerWrote, closedBeforeNextSetup, uncaughtErrors }) {
		yield* runTimeoutStories();

		yield* outcomes({
			"closed before the next story set up": [closedBeforeNextSetup(), ["the hanging story's database"]],
			"the hanging story": [timeoutStoryOutcome("the hanging story"), "timed out"],
			"the hanging story's worker wrote": [workerWrote("the hanging story"), ["seed", "before timeout"]],
			"the next story": [timeoutStoryOutcome("the next story"), "passed"],
			"the next story's worker wrote": [workerWrote("the next story"), ["seed", "after timeout"]],
			"uncaught errors": [uncaughtErrors(), []],
		});
	},
	60_000,
);
