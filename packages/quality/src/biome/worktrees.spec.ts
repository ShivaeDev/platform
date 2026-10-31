import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { hookInstalled, linkedWorktree, projectIn, withoutConfig } from "#test/linkedWorktree.ts";

const MESSY = {
	content: 'import { join } from "node:path";\nimport { readFile } from "node:fs/promises";\n\nexport const total   =  [join, readFile].length\n',
	path: "src/total.ts",
};
const FIXED = 'import { readFile } from "node:fs/promises";\nimport { join } from "node:path";\n\nexport const total = [join, readFile].length;\n';
const UNFORMATTED = `${MESSY.path}  Is not formatted. Run \`quality fix\`.`;
// Biome matches this folder glob against the folders above the root too, so inside `.worktrees/` it ignores every file.
const IGNORING_WORKTREES = {
	content: '{ "extends": ["@shivaedev/quality/biome/preset.json"], "files": { "includes": ["**", "!**/.worktrees"] } }\n',
	path: "biome.json",
};

for (const [where, layout] of [
	["at the repository root", [withoutConfig()]],
	["in app/", [withoutConfig(), projectIn("app")]],
] as const) {
	checkoutStory.it(
		`quality lint in a linked worktree under .worktrees reports a misformatted file and its unsorted imports in a project ${where}`,
		[...layout, linkedWorktree("feature", { files: [MESSY] })],
		function* ({ outcome, runsIn, stdout }) {
			yield* runsIn("feature", "lint");

			yield* outcomes([
				["exit", () => outcome(), "rejected"],
				["format finding", () => stdout(), expect.stringContaining(UNFORMATTED)],
				["import order finding", () => stdout(), expect.stringContaining("error biome/assist/source/organizeImports (1)")],
			]);
		},
		CLI_TIMEOUT,
	);
}

checkoutStory.it(
	"the pre-commit hook rejects a commit in a linked worktree under .worktrees with a misformatted file",
	[withoutConfig(), linkedWorktree("feature", { files: [MESSY] }), hookInstalled()],
	function* ({ commitErrors, commitOutcome, commitsIn }) {
		yield* commitsIn("feature", "Messy");

		yield* outcomes([
			["commit", () => commitOutcome(), "rejected"],
			["finding", () => commitErrors(), expect.stringContaining(UNFORMATTED)],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality fix in a linked worktree under .worktrees formats a file and sorts its imports",
	[withoutConfig(), linkedWorktree("feature", { files: [MESSY] })],
	function* ({ outcome, readsIn, runsIn }) {
		expect(yield* readsIn("feature", MESSY.path)).toBe(MESSY.content);

		yield* runsIn("feature", "fix");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["file", () => readsIn("feature", MESSY.path), FIXED],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality lint in the primary checkout passes without the misformatted file in .worktrees",
	[withoutConfig(), linkedWorktree("feature", { files: [MESSY] })],
	function* ({ runs }) {
		const answer = yield* runs("lint");

		expect(answer.outcome).toBe("passed");
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality fix in the primary checkout leaves the misformatted file in .worktrees untouched",
	[withoutConfig(), linkedWorktree("feature", { files: [MESSY] })],
	function* ({ outcome, readsIn, runs }) {
		yield* runs("fix");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["file", () => readsIn("feature", MESSY.path), MESSY.content],
		]);
	},
	CLI_TIMEOUT,
);

for (const command of ["lint", "fix"]) {
	checkoutStory.it(
		`quality ${command} in a linked worktree whose Biome config leaves no file to check refuses with Biome's message`,
		[withoutConfig(), linkedWorktree("feature", { files: [MESSY, IGNORING_WORKTREES] })],
		function* ({ outcome, runsIn, stderr }) {
			yield* runsIn("feature", command);

			yield* outcomes([
				["exit", () => outcome(), "invalid"],
				["explanation", () => stderr(), expect.stringContaining("exited 1 without a failing diagnostic:")],
				["message", () => stderr(), expect.stringContaining("No files were processed in the specified paths.")],
			]);
		},
		CLI_TIMEOUT,
	);
}
