import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import { committedIn, hookManagerRuns, separateGitDir, untrackedIn, worktreeTopHas } from "#test/hookManager.ts";
import { linkedWorktree, projectIn, stagedPreCommit } from "#test/linkedWorktree.ts";
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

for (const [where, layout] of [
	["at the top of the worktree", []],
	["in a package folder below the top", [projectIn("app")]],
] as const) {
	checkoutStory.it(
		`quality lint from another hook manager's pre-commit hook in a linked worktree, with the project ${where}, leaves out build output that the .gitignore at the top ignores, as a run from a shell does`,
		[...layout, linkedWorktree("feature", { files: [BUILD_OUTPUT] }), worktreeTopHas("feature", GITIGNORE), hookManagerRuns("lint")],
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
		`quality baseline tighten --staged from another hook manager's pre-commit hook in a linked worktree, with the project ${where}, removes the debt of build output the author stops tracking and the .gitignore at the top ignores`,
		[
			...layout,
			linkedWorktree("feature"),
			committedIn("feature", BUILD_OUTPUT, BUILD_OUTPUT_DEBT),
			untrackedIn("feature", BUILD_OUTPUT.path),
			worktreeTopHas("feature", GITIGNORE),
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
		`the staged check from another hook manager's pre-commit hook in a linked worktree, with the project ${where}, rejects an edit that git commit --all stages only in the index git hands the hook`,
		[...layout, stagedPreCommit(), linkedWorktree("feature", { files: [UNFORMATTED] }), hookManagerRuns("hooks pre-commit")],
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
}

checkoutStory.it(
	"quality lint from the pre-commit hook of a separate git dir whose work tree is the project folder, inside another repository, takes that folder as the top and checks a file the separate git dir tracks although its .gitignore ignores it",
	[projectIn("home"), separateGitDir("lint", GITIGNORE, BUILD_OUTPUT)],
	function* ({ commitErrors, commitOutcome, commits }) {
		yield* commits("Checked");

		yield* withMatchers((expect) =>
			outcomes([
				["commit", () => commitOutcome(), "rejected"],
				["finding", () => commitErrors(), expect.stringContaining(`${BUILD_OUTPUT.path}  4 lines exceeds the 3-line limit.`)],
			]),
		);
	},
	CLI_TIMEOUT,
);
