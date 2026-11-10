import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import {
	checkoutFails,
	deletes,
	hookInstalled,
	inCloudSession,
	makesExecutable,
	packageScripts,
	projectHas,
	relinks,
	stagedPreCommit,
	stages,
	stagesLink,
} from "#test/linkedWorktree.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { logs } from "#testing/adapters/hookRepository.ts";

const FORMATTED = { content: "export function value(): number {\n\treturn 1;\n}\n", path: "src/value.ts" };
const UNFORMATTED = { content: "export function value(): number {\nreturn 1;\n}\n", path: "src/value.ts" };
const STRAY = { content: "export function stray(): number {\nreturn 1;\n}\n", path: "src/stray.ts" };
const FULL_UNFORMATTED = { content: "export function full(): number {\nreturn 1;\n}\n", path: "src/full.ts" };
const FOUR_LINES = { content: "export function value(): number {\n\tconst one = 1;\n\treturn one;\n}\n", path: "src/value.ts" };
const OTHER = { content: "export function other(): number {\n\treturn 2;\n}\n", path: "src/other.ts" };
const VENDOR_STAGED = { content: "export function vendor(): number {\n\treturn 1;\n}\n", path: "src/vendor.ts" };
const VENDOR_EDITED = { content: "export function vendor(): number {\n\treturn 2;\n}\n", path: "src/vendor.ts" };
const HELD_STAGED = { content: "export function held(): number {\n\treturn 1;\n}\n", path: "src/held.ts" };
const HELD_EDITED = { content: "export function held(): number {\n\treturn 2;\n}\n", path: "src/held.ts" };
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
	"a staged pre-commit whose checkout of staged content fails after writing some files refuses the commit and puts every working copy back",
	[stagedPreCommit(), checkoutFails(VENDOR_STAGED.path), stages(UNFORMATTED, VENDOR_STAGED), projectHas(FORMATTED, VENDOR_EDITED), hookInstalled()],
	function* ({ commitErrors, commitOutcome, commits, reads }) {
		yield* commits("Checkout fails");

		yield* withMatchers((expect) =>
			outcomes([
				["commit", () => commitOutcome(), "rejected"],
				["reason", () => commitErrors(), expect.stringContaining("smudge filter broken failed")],
				["written copy", () => reads(FORMATTED.path), FORMATTED.content],
				["unwritten copy", () => reads(VENDOR_EDITED.path), VENDOR_EDITED.content],
			]),
		);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit that cannot put one working copy back still puts back the others and prints the command that recovers the one it could not",
	[stagedPreCommit(), stages(HELD_STAGED, UNFORMATTED), projectHas(HELD_EDITED, FORMATTED)],
	function* ({ commitCheckWhileFolderReplaces, reads, stderr }) {
		yield* commitCheckWhileFolderReplaces(HELD_EDITED.path);

		yield* withMatchers((expect) =>
			outcomes([
				[
					"unrestored copy",
					() => stderr(),
					expect.stringMatching(
						/quality: cannot put back the working copy of src\/held\.ts: .+\n {2}git cat-file blob [0-9a-f]{40} > src\/held\.ts && chmod 644 src\/held\.ts\n/u,
					),
				],
				["restored copy", () => reads(FORMATTED.path), FORMATTED.content],
			]),
		);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit killed while Biome checks the staged content has printed the commands that get the working copy back",
	[stagedPreCommit(), stages(UNFORMATTED), projectHas(FORMATTED)],
	function* ({ commitCheckKilledWhileBiomeRuns, reads, runsPrintedRecovery }) {
		yield* commitCheckKilledWhileBiomeRuns();

		yield* outcomes([["copy on disk", () => reads(FORMATTED.path), UNFORMATTED.content]]);

		yield* runsPrintedRecovery();

		yield* outcomes([["copy on disk", () => reads(FORMATTED.path), FORMATTED.content]]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit leaves a file deleted after staging deleted",
	[stagedPreCommit(), stages(FORMATTED), deletes(FORMATTED.path), hookInstalled()],
	function* ({ commitOutcome, commits, reads }) {
		yield* commits("Deleted after staging");

		yield* outcomes([
			["commit", () => commitOutcome(), "committed"],
			["copy on disk", () => reads(FORMATTED.path), undefined],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit puts back a staged link pointed elsewhere afterwards, without writing through to the staged target",
	[
		stagedPreCommit(),
		stages(FORMATTED),
		projectHas(OTHER),
		stagesLink("src/current.ts", "value.ts"),
		relinks("src/current.ts", "other.ts"),
		hookInstalled(),
	],
	function* ({ commitOutcome, commits, linkTarget, reads }) {
		yield* commits("Link moved after staging");

		yield* outcomes([
			["commit", () => commitOutcome(), "committed"],
			["link", () => linkTarget("src/current.ts"), "other.ts"],
			["staged target", () => reads(FORMATTED.path), FORMATTED.content],
		]);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"a staged pre-commit keeps a mode change made after staging",
	[stagedPreCommit(), stages(FORMATTED), makesExecutable(FORMATTED.path), hookInstalled()],
	function* ({ commitOutcome, commits, mode }) {
		yield* commits("Made executable after staging");

		yield* outcomes([
			["commit", () => commitOutcome(), "committed"],
			["mode", () => mode(FORMATTED.path), "755"],
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
