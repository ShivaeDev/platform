import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { storyProgramRun } from "#test/storyProgramRun.ts";

storyProgramRun.it(
	"a run's story rules share one story program and the run drops it after the last of them",
	[],
	function* ({ programAfterRun, programsDuringRun, runs }) {
		yield* runs();

		yield* outcomes([
			["programs the story rules read", () => programsDuringRun(), "one program"],
			["story program after the run", () => programAfterRun(), "a new program"],
		]);
	},
);
