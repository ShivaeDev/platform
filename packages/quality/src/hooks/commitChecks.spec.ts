import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { logs } from "#test/hookRepository.ts";
import {
	hookInstalled,
	linkedWorktree,
	noPackageManifest,
	packageScripts,
	pnpmDeclared,
	projectHas,
	projectIn,
	withoutConfig,
} from "#test/linkedWorktree.ts";

const COMMIT_AGAIN =
	"help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.";
const LINT_PASSED = "quality: passed. 1 source file checked.";
const TOO_LONG = { content: "export const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\n", path: "src/full.ts" };

checkoutStory.it(
	"quality hooks pre-commit in a project without a package.json lints and runs no script",
	[noPackageManifest()],
	function* ({ outcome, reported, runs }) {
		yield* runs("hooks", "pre-commit");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["report", () => reported(), [LINT_PASSED]],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks pre-commit lints, then runs the typecheck and quality:commit scripts with npm",
	[packageScripts({ "quality:commit": logs("repository checked"), "typecheck": logs("typechecked") })],
	function* ({ outcome, reported, runs, scriptLog }) {
		yield* runs("hooks", "pre-commit");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["report", () => reported(), [LINT_PASSED, "quality: running `npm run typecheck`", "quality: running `npm run quality:commit`"]],
			["script log", () => scriptLog(), ["typechecked", "repository checked"]],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks pre-commit runs quality:commit alone when package.json has no typecheck script",
	[packageScripts({ "quality:commit": logs("repository checked") })],
	function* ({ outcome, reported, runs, scriptLog }) {
		yield* runs("hooks", "pre-commit");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["report", () => reported(), [LINT_PASSED, "quality: running `npm run quality:commit`"]],
			["script log", () => scriptLog(), ["repository checked"]],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks pre-commit runs the scripts with the package manager that package.json declares",
	[packageScripts({ typecheck: logs("typechecked") }), pnpmDeclared()],
	function* ({ reported, runs, scriptLog }) {
		yield* runs("hooks", "pre-commit");

		yield* outcomes([
			["report", () => reported(), [LINT_PASSED, "quality: running `pnpm run typecheck`"]],
			["script log", () => scriptLog(), ["typechecked"]],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks pre-commit refuses a package.json whose script is not a string and names the invalid file",
	[projectHas({ content: '{ "scripts": { "typecheck": 3 } }', path: "package.json" })],
	function* ({ outcome, runs, stderr }) {
		yield* runs("hooks", "pre-commit");

		yield* outcomes([
			["error", () => stderr(), expect.stringContaining("package.json is invalid")],
			["exit", () => outcome(), "invalid"],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks pre-commit runs every check after one fails and names each failed check before saying how to go on",
	[packageScripts({ "quality:commit": `${logs("still ran")}; exit 4`, "typecheck": "exit 3" }), projectHas(TOO_LONG)],
	function* ({ outcome, runs, scriptLog, stderr }) {
		yield* runs("hooks", "pre-commit");

		yield* outcomes([
			[
				"error",
				() => stderr(),
				`quality: pre-commit failed: quality lint, \`npm run typecheck\` (exit code 3), \`npm run quality:commit\` (exit code 4).\n${COMMIT_AGAIN}\n`,
			],
			["exit", () => outcome(), "rejected"],
			["script log", () => scriptLog(), ["still ran"]],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"the pre-commit hook rejects a commit that breaks a rule, reports the finding and how to go on, and records no commit",
	[projectHas(TOO_LONG), hookInstalled()],
	function* ({ commitErrors, commitOutcome, commits, history }) {
		yield* commits("Too long");

		yield* outcomes([
			["commit", () => commitOutcome(), "rejected"],
			["finding", () => commitErrors(), expect.stringContaining("src/full.ts  4 lines exceeds the 3-line limit.")],
			["history", () => history(), ["Base"]],
			["verdict", () => commitErrors(), expect.stringContaining(`quality: pre-commit failed: quality lint.\n${COMMIT_AGAIN}\n`)],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"the pre-commit hook that quality hooks install wrote into a repository without a config runs the typecheck script on commit",
	[withoutConfig(), packageScripts({ typecheck: logs("typechecked") }), hookInstalled()],
	function* ({ commitOutcome, commits, scriptLog }) {
		expect(yield* scriptLog()).toEqual([]);

		yield* commits("Checked");

		yield* outcomes([
			["commit", () => commitOutcome(), "committed"],
			["script log", () => scriptLog(), ["typechecked"]],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"the pre-commit hook of a project below the repository root runs its checks from the project's folder",
	[projectIn("app"), packageScripts({ "quality:commit": logs("checked from app") }), hookInstalled()],
	function* ({ commitOutcome, commits, scriptLog }) {
		expect(yield* scriptLog()).toEqual([]);

		yield* commits("Checked from app");

		yield* outcomes([
			["commit", () => commitOutcome(), "committed"],
			["script log", () => scriptLog(), ["checked from app"]],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"the pre-commit hook checks a commit in a linked worktree with that worktree's own scripts",
	[hookInstalled(), linkedWorktree("stricter", { scripts: { "quality:commit": "exit 4" } })],
	function* ({ commitErrors, commitOutcome, commitsIn }) {
		yield* commitsIn("stricter", "Stricter");

		yield* outcomes([
			["commit", () => commitOutcome(), "rejected"],
			["verdict", () => commitErrors(), expect.stringContaining("quality: pre-commit failed: `npm run quality:commit` (exit code 4).")],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"the pre-commit hook rejects a commit in a linked worktree without its dependencies and says how to go on",
	[hookInstalled(), linkedWorktree("fresh", { dependencies: false })],
	function* ({ commitErrors, commitOutcome, commitsIn, folder }) {
		const fresh = yield* folder("fresh");

		yield* commitsIn("fresh", "Unchecked");

		yield* outcomes([
			["commit", () => commitOutcome(), "rejected"],
			[
				"error",
				() => commitErrors(),
				`quality: cannot check this commit: ${fresh}/node_modules/.bin/quality does not exist.\nhelp: install the dependencies of this worktree, then commit again.\n`,
			],
		]);
	},
	CLI_TIMEOUT,
);
