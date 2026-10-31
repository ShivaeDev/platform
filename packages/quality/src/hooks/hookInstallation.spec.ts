import { dirname } from "node:path";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { hookInstalled, linkedWorktree, outsideGit, ownHook, qualityFileAt } from "#test/linkedWorktree.ts";

const OWN_HOOK = "#!/bin/sh\nmake check\n";

checkoutStory.it(
	"quality hooks install outside a git repository refuses and explains how to start one",
	[outsideGit()],
	function* ({ folder, outcome, runs, stderr, stdout }) {
		const project = yield* folder();

		yield* runs("hooks", "install");

		yield* outcomes({
			"error": [
				stderr(),
				`quality: ${project} is not in a git work tree, so there is no hook to manage.\nhelp: run quality from inside the repository, or run \`git init\` first.\n`,
			],
			"exit": [outcome(), "invalid"],
			"report": [stdout(), ""],
		});
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks install over quality's own hook says the hook is up to date",
	[hookInstalled()],
	function* ({ hookFile, runs, stdout }) {
		const hook = yield* hookFile();

		yield* runs("hooks", "install");

		expect(yield* stdout()).toBe(
			`quality: the pre-commit hook at ${hook} is up to date.\nquality: set repository-local core.hooksPath to ${dirname(hook)}.\nquality: no executable global pre-commit hook to chain.\n`,
		);
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks install keeps a pre-commit hook that is not quality's and says how to check commits from it",
	[ownHook(OWN_HOOK)],
	function* ({ hookFile, hookScript, outcome, runs, stderr }) {
		const hook = yield* hookFile();

		yield* runs("hooks", "install");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"hook": [hookScript(), OWN_HOOK],
			"warning": [
				stderr(),
				`quality: kept ${hook}: it is not quality's pre-commit hook, so quality does not check commits.\nhelp: call \`node_modules/.bin/quality hooks pre-commit\` from that hook, or replace it with \`quality hooks install --force\`.\n`,
			],
		});
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks install --force replaces a pre-commit hook that is not quality's and says so",
	[ownHook(OWN_HOOK)],
	function* ({ hook, hookFile, runs, stdout }) {
		const path = yield* hookFile();
		expect(yield* hook()).toBe("another");

		yield* runs("hooks", "install", "--force");

		yield* outcomes({
			"hook": [hook(), "quality's"],
			"report": [stdout(), expect.stringContaining(`quality: replaced ${path}, which was not quality's hook;`)],
		});
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks install in a linked worktree writes quality's hook into the hooks every worktree shares",
	[linkedWorktree("feature")],
	function* ({ hook, outcome, runsIn }) {
		expect(yield* hook()).toBe("none");

		yield* runsIn("feature", "hooks", "install");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"hook": [hook(), "quality's"],
		});
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks install run from the repository's own quality file writes a hook that runs that file with the same Node options",
	[qualityFileAt("tools/quality.ts")],
	function* ({ hookLines, outcome, runsOwnQuality }) {
		yield* runsOwnQuality("hooks", "install");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"hook": [
				hookLines(),
				expect.arrayContaining(["quality=tools/quality.ts", 'node --conditions=source "$quality" hooks pre-commit || status=$?']),
			],
		});
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks uninstall in a repository without a hook says there is none",
	[],
	function* ({ hookFile, outcome, runs, stdout }) {
		const hook = yield* hookFile();

		yield* runs("hooks", "uninstall");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"report": [stdout(), `quality: there is no pre-commit hook at ${hook}.\n`],
		});
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks uninstall removes quality's hook and says so",
	[hookInstalled()],
	function* ({ hook, hookFile, runs, stdout }) {
		const path = yield* hookFile();
		expect(yield* hook()).toBe("quality's");

		yield* runs("hooks", "uninstall");

		yield* outcomes({
			"hook": [hook(), "none"],
			"report": [stdout(), `quality: removed the pre-commit hook at ${path}.\n`],
		});
	},
	CLI_TIMEOUT,
);

checkoutStory.it(
	"quality hooks uninstall keeps a pre-commit hook that is not quality's and says so",
	[ownHook(OWN_HOOK)],
	function* ({ hookFile, hookScript, runs, stderr }) {
		const hook = yield* hookFile();

		yield* runs("hooks", "uninstall");

		yield* outcomes({
			"hook": [hookScript(), OWN_HOOK],
			"warning": [stderr(), `quality: kept ${hook}: it is not quality's pre-commit hook.\n`],
		});
	},
	CLI_TIMEOUT,
);
