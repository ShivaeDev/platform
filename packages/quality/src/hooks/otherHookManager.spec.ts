import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import { committedIn, hookManagerRuns, untrackedIn } from "#test/hookManager.ts";
import { linkedWorktree, stagedPreCommit } from "#test/linkedWorktree.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { assertThat, withMatchers } from "#testing/assertThat.ts";

const GITIGNORE = { content: "node_modules/\ndist/\n", path: ".gitignore" };
const BUILD_OUTPUT = {
	content: "export const first = 1;\nexport const second = 2;\nexport const third = 3;\nexport const fourth = 4;\n",
	path: "src/dist/out.js",
};
const BUILD_OUTPUT_DEBT = {
	content: `{"path":"${BUILD_OUTPUT.path}","rule":"structure/max-lines","count":1}\n`,
	path: "quality-baseline.jsonl",
};
const UNFORMATTED = { content: "export function full(): number {\n\treturn   1\n}\n", path: "src/full.ts" };

checkoutStory.it(
	"quality lint from another hook manager's pre-commit hook in a linked worktree leaves out build output that the root .gitignore ignores in a source folder, as a run from a shell does",
	[linkedWorktree("feature", { files: [GITIGNORE, BUILD_OUTPUT] }), hookManagerRuns("lint")],
	function* ({ commitErrors, commitOutcome, commitsIn, outcome, runsIn }) {
		yield* runsIn("feature", "lint");
		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));

		yield* commitsIn("feature", "Checked");

		yield* withMatchers((expect) =>
			outcomes([
				["commit", () => commitOutcome(), "committed"],
				["hook output", () => commitErrors(), expect.not.stringContaining(BUILD_OUTPUT.path)],
			]),
		);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality baseline tighten --staged from another hook manager's pre-commit hook in a linked worktree removes the debt of build output the author stops tracking and the root .gitignore ignores",
	[
		linkedWorktree("feature"),
		committedIn("feature", BUILD_OUTPUT, BUILD_OUTPUT_DEBT),
		untrackedIn("feature", BUILD_OUTPUT.path, GITIGNORE),
		hookManagerRuns("baseline tighten --staged"),
	],
	function* ({ commitErrors, commitOutcome, commitsIn, readsIn }) {
		yield* commitsIn("feature", "Untracked build output");

		yield* withMatchers((expect) =>
			outcomes([
				["commit", () => commitOutcome(), "committed"],
				["hook output", () => commitErrors(), expect.stringContaining("quality: removed 1 entry")],
				["baseline", () => readsIn("feature", BUILD_OUTPUT_DEBT.path), expect.not.stringContaining(BUILD_OUTPUT.path)],
			]),
		);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"the staged check from another hook manager's pre-commit hook in a linked worktree rejects an edit that git commit --all stages only in the index git hands the hook",
	[stagedPreCommit(), linkedWorktree("feature", { files: [UNFORMATTED] }), hookManagerRuns("hooks pre-commit")],
	function* ({ commitErrors, commitOutcome, commitsEditsIn }) {
		yield* commitsEditsIn("feature", "Unformatted");

		yield* withMatchers((expect) =>
			outcomes([
				["commit", () => commitOutcome(), "rejected"],
				["finding", () => commitErrors(), expect.stringContaining(`${UNFORMATTED.path}  Is not formatted.`)],
			]),
		);
	},
	CLI_TIMEOUT,
);
