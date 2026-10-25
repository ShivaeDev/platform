import { afterEach, expect } from "vitest";
import { chainingPreCommit, pushDestination, RECORDING_COMMIT_MESSAGE, RECORDING_PUSH } from "#quality/test-support/globalHookFixtures.ts";
import { globalHook, hookStory } from "#quality/test-support/hookStory.ts";
import { CLI_EXIT } from "#quality-fixtures/cli.ts";
import { removeSeededTrees } from "#quality-fixtures/tree.ts";

afterEach(removeSeededTrees);

hookStory.it(
	"keeps commit-msg and pre-push guards running with their arguments and input",
	[globalHook(), pushDestination()],
	({ git, hooks, recorded }) => {
		hooks.writeGlobal("commit-msg", RECORDING_COMMIT_MESSAGE);
		hooks.writeGlobal("pre-push", RECORDING_PUSH);
		expect(hooks.run("install").status).toBe(CLI_EXIT.passed);
		expect(git.commit().status).toBe(CLI_EXIT.passed);
		expect(recorded.hookLog("commit-msg")).toBe(".git/COMMIT_EDITMSG\nChecked\n");
		expect(git.push().status).toBe(CLI_EXIT.passed);
		expect(recorded.hookLog("pre-push")).toMatch(/^(?<destination>.+\/remote.git)\n\k<destination>\nHEAD [a-f0-9]{40} refs\/heads\/main 0{40}\n$/u);
		expect(recorded.qualityLog()).toBe("quality\n");
	},
);

hookStory.it("runs a global reference-transaction guard added after installation", [globalHook()], ({ git, hooks, recorded }) => {
	expect(hooks.run("install").status).toBe(CLI_EXIT.passed);
	hooks.writeGlobal("reference-transaction", '#!/bin/sh\nprintf "%s\\n" "$@" >> reference-transaction.log\ncat >> reference-transaction.log\n');
	expect(git.commit().status).toBe(CLI_EXIT.passed);
	expect(recorded.hookLog("reference-transaction")).toMatch(/(?:^|\n)prepared\n[a-f0-9]{40} [a-f0-9]{40} refs\/heads\/main\n/u);
	expect(recorded.hookLog("reference-transaction")).toContain("committed\n");
});

hookStory.it("preserves a forwarded hook's arguments, stdin and failing exit status", [globalHook()], ({ git, hooks, recorded }) => {
	expect(hooks.run("install").status).toBe(CLI_EXIT.passed);
	hooks.writeGlobal("pre-push", '#!/bin/sh\nprintf "%s\\n" "$@" >> pre-push.log\ncat >> pre-push.log\nexit 7\n');
	expect(git.runHook("pre-push", ["origin", "destination with spaces"], "pending refs\n").status).toBe(7);
	expect(recorded.hookLog("pre-push")).toBe("origin\ndestination with spaces\npending refs\n");
});

hookStory.it("leaves global commit and push guards in effect after uninstall", [globalHook(), pushDestination()], ({ git, hooks, recorded }) => {
	hooks.writeGlobal("commit-msg", RECORDING_COMMIT_MESSAGE);
	hooks.writeGlobal("pre-push", RECORDING_PUSH);
	expect(hooks.run("install").status).toBe(CLI_EXIT.passed);
	expect(git.commit().status).toBe(CLI_EXIT.passed);
	expect(git.push().status).toBe(CLI_EXIT.passed);
	expect(recorded.hookLog("commit-msg")).toBe(".git/COMMIT_EDITMSG\nChecked\n");
	expect(recorded.hookLog("pre-push")).toContain("refs/heads/main");
	expect(hooks.run("uninstall").status).toBe(CLI_EXIT.passed);
	expect(git.commit().status).toBe(CLI_EXIT.passed);
	expect(git.push().status).toBe(CLI_EXIT.passed);
	expect(recorded.hookLog("commit-msg")).toBe(".git/COMMIT_EDITMSG\nChecked\n.git/COMMIT_EDITMSG\nChecked\n");
	expect(recorded.hookLog("pre-push")).toMatch(/refs\/heads\/main[\s\S]+refs\/heads\/main/u);
	expect(recorded.qualityLog()).toBe("quality\n");
});

for (const localPath of [true, false]) {
	hookStory.it(
		`runs Quality once when a global guard chains the repository hook with local hooksPath ${localPath ? "set" : "unset"}`,
		[globalHook()],
		({ git, hooks, recorded }) => {
			hooks.writeGlobal("pre-commit", chainingPreCommit);
			expect(hooks.run("install").status).toBe(CLI_EXIT.passed);
			if (!localPath) {
				expect(git.config("--local", "--unset-all", "core.hooksPath").status).toBe(CLI_EXIT.passed);
			}
			expect(git.commit().status).toBe(CLI_EXIT.passed);
			expect(recorded.qualityLog()).toBe("quality\n");
		},
	);
}

hookStory.it("flags a legacy installation that hides global guards and repairs it on reinstall", [globalHook()], ({ git, hooks, recorded }) => {
	hooks.writeGlobal("commit-msg", RECORDING_COMMIT_MESSAGE);
	expect(hooks.run("install").status).toBe(CLI_EXIT.passed);
	const forwarding = git.config("--local", "--get", "core.hooksPath").stdout.trim();
	expect(git.config("--local", "core.hooksPath", `${forwarding}/..`).status).toBe(CLI_EXIT.passed);
	const status = hooks.run("status");
	expect(status.status).toBe(CLI_EXIT.rejected);
	expect(status.stderr).toContain("hides global hooks");
	expect(status.stderr).toContain("quality hooks install");
	expect(hooks.run("install").status).toBe(CLI_EXIT.passed);
	expect(hooks.run("status").status).toBe(CLI_EXIT.passed);
	expect(git.commit().status).toBe(CLI_EXIT.passed);
	expect(recorded.hookLog("commit-msg")).toBe(".git/COMMIT_EDITMSG\nChecked\n");
});
