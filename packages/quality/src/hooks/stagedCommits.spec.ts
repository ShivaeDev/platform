import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import { hookInstalled, inCloudSession, packageScripts, projectHas, stagedPreCommit, stages } from "#test/linkedWorktree.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { logs } from "#testing/adapters/hookRepository.ts";

const FORMATTED = { content: "export function value(): number {\n\treturn 1;\n}\n", path: "src/value.ts" };
const UNFORMATTED = { content: "export function value(): number {\nreturn 1;\n}\n", path: "src/value.ts" };
const STRAY = { content: "export function stray(): number {\nreturn 1;\n}\n", path: "src/stray.ts" };
const FULL_UNFORMATTED = { content: "export function full(): number {\nreturn 1;\n}\n", path: "src/full.ts" };
const FOUR_LINES = { content: "export function value(): number {\n\tconst one = 1;\n\treturn one;\n}\n", path: "src/value.ts" };
const SCRIPTS = { "quality:commit": logs("repository checked"), "typecheck": logs("typechecked") };

checkoutStory.it(
	"a staged pre-commit refuses a staged file that Biome would format, names it and says how to go on",
	[stagedPreCommit(), stages(UNFORMATTED), hookInstalled()],
	function* ({ commitErrors, commitOutcome, commits, history }) {
		yield* commits("Unformatted");

		yield* withMatchers((expect) =>
			outcomes([
				["commit", () => commitOutcome(), "rejected"],
				["finding", () => commitErrors(), expect.stringContaining("src/value.ts  Is not formatted. Run `quality fix`.")],
				["history", () => history(), ["Base"]],
				["verdict", () => commitErrors(), expect.stringContaining("quality: pre-commit failed: Biome on the staged files.")],
			]),
		);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit checks the staged content, so a file staged clean commits although its copy on disk, an unstaged change and an untracked file have Biome faults",
	[stagedPreCommit(), stages(FORMATTED), projectHas(UNFORMATTED, FULL_UNFORMATTED, STRAY), hookInstalled()],
	function* ({ commitOutcome, commits, reads }) {
		yield* commits("Staged clean");

		yield* outcomes([
			["commit", () => commitOutcome(), "committed"],
			["copy on disk", () => reads(UNFORMATTED.path), UNFORMATTED.content],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit refuses a file staged with a Biome fault and fixed on disk afterwards, and leaves the fixed copy on disk",
	[stagedPreCommit(), stages(UNFORMATTED), projectHas(FORMATTED), hookInstalled()],
	function* ({ commitOutcome, commits, reads }) {
		yield* commits("Fixed after staging");

		yield* outcomes([
			["commit", () => commitOutcome(), "rejected"],
			["copy on disk", () => reads(FORMATTED.path), FORMATTED.content],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit runs neither quality lint nor the typecheck and quality:commit scripts",
	[stagedPreCommit(), packageScripts(SCRIPTS), stages(FOUR_LINES), hookInstalled()],
	function* ({ commitOutcome, commits, scriptLog }) {
		yield* commits("Over the line limit");

		yield* outcomes([
			["commit", () => commitOutcome(), "committed"],
			["script log", () => scriptLog(), []],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit in a Claude Code cloud session runs the full checks",
	[stagedPreCommit(), packageScripts(SCRIPTS), stages(FOUR_LINES), inCloudSession(), hookInstalled()],
	function* ({ commitErrors, commitOutcome, commits, scriptLog }) {
		yield* commits("Over the line limit");

		yield* withMatchers((expect) =>
			outcomes([
				["commit", () => commitOutcome(), "rejected"],
				["finding", () => commitErrors(), expect.stringContaining("src/value.ts  4 lines exceeds the 3-line limit.")],
				["script log", () => scriptLog(), ["typechecked", "repository checked"]],
			]),
		);
	},
	CLI_TIMEOUT,
);
