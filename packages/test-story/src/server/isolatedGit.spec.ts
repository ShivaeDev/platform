import { expect } from "vitest";
import { outcomes } from "#server/outcomes.ts";
import { gitRepository, handedRefusingGlobalConfig, outerRepositoryHook, refusingGlobalConfig, refusingSystemConfig } from "#test/gitRepository.ts";

gitRepository.it(
	"a commit through the isolated runner skips the refusing hook that the developer's global and system Git configs name",
	[refusingGlobalConfig, refusingSystemConfig],
	function* ({ commits }) {
		expect(yield* commits()).toBe("committed");
	},
);

gitRepository.it(
	"a commit through the isolated runner lands in its own repository with its own author, committer and file, and leaves the outer repository alone, when a hook of that repository runs the tests",
	[outerRepositoryHook],
	function* ({ commits, committedFiles, outerCommits, repositoryCommits }) {
		yield* commits();

		yield* outcomes([
			["story repository history", () => repositoryCommits(), ["Story, Story: Add the README"]],
			["story repository files", () => committedFiles(), ["README.md"]],
			["outer repository history", () => outerCommits(), ["Outer, Outer: Outer commit"]],
		]);
	},
);

gitRepository.it(
	"the isolated runner applies a global Git config that the kit hands it on purpose",
	[refusingGlobalConfig, handedRefusingGlobalConfig],
	function* ({ commits }) {
		expect(yield* commits()).toBe("refused: the hostile hook refuses every commit");
	},
);
