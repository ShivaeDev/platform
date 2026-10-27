import { afterEach, expect } from "vitest";
import { globalHook, hookStory, includedGlobalConfig, qualityFails } from "#quality/test-support/hookStory.ts";
import { removeSeededTrees } from "#quality-fixtures/tree.ts";

afterEach(removeSeededTrees);

hookStory.it("blocks a commit when an included global guard fails", [globalHook(7), includedGlobalConfig("include")], ({ git, hooks, recorded }) => {
	const before = recorded.globalConfig();
	const installed = hooks.run("install");
	expect(installed.status).toBe(0);
	const exitCode = git.commit().status;
	expect(exitCode).toBe(1);
	expect(recorded.globalLog()).toBe("global\n");
	expect(recorded.qualityLog()).toBe("quality\n");
	expect(installed.stdout).toContain("chaining global pre-commit hook");
	expect(hooks.run("status").stdout).toContain("chaining global pre-commit hook");
	expect(recorded.globalConfig()).toBe(before);
});

hookStory.it(
	"blocks a commit when a conditionally included global guard fails",
	[globalHook(7), includedGlobalConfig("includeIf")],
	({ git, hooks, recorded }) => {
		const before = recorded.globalConfig();
		const installed = hooks.run("install");
		expect(installed.status).toBe(0);
		const exitCode = git.commit().status;
		expect(exitCode).toBe(1);
		expect(recorded.globalLog()).toBe("global\n");
		expect(recorded.qualityLog()).toBe("quality\n");
		expect(installed.stdout).toContain("chaining global pre-commit hook");
		expect(hooks.run("status").stdout).toContain("chaining global pre-commit hook");
		expect(recorded.globalConfig()).toBe(before);
	},
);

hookStory.it("blocks a commit when Quality fails alongside a passing global guard", [globalHook(), qualityFails()], ({ git, hooks, recorded }) => {
	expect(hooks.run("install").status).toBe(0);
	const commit = git.commit();
	const exitCode = commit.status;
	expect(exitCode).toBe(1);
	expect(commit.stderr).toContain("quality: pre-commit failed");
	expect(recorded.globalLog()).toBe("global\n");
	expect(recorded.qualityLog()).toBe("quality\n");
});

hookStory.it("does not chain itself when the global path points at Quality", [], ({ git, hooks, recorded }) => {
	expect(hooks.run("install").status).toBe(0);
	const path = git.config("--local", "--get", "core.hooksPath").stdout.trim();
	expect(git.config("--global", "core.hooksPath", path).status).toBe(0);
	expect(hooks.run("install").stdout).toContain("no executable global pre-commit hook to chain");
	expect(git.commit().status).toBe(0);
	expect(recorded.qualityLog()).toBe("quality\n");
});

hookStory.it("keeps a later local hooks path when uninstalling", [], ({ git, hooks }) => {
	expect(hooks.run("install").status).toBe(0);
	expect(git.config("--local", "core.hooksPath", ".other-hooks").status).toBe(0);
	expect(hooks.run("uninstall").status).toBe(0);
	expect(git.config("--local", "--get", "core.hooksPath").stdout.trim()).toBe(".other-hooks");
});

hookStory.it("runs Quality and the global guard without changing global config", [globalHook()], ({ git, hooks, recorded }) => {
	const before = recorded.globalConfig();
	const installed = hooks.run("install");
	expect(installed.status).toBe(0);
	expect(installed.stdout).toContain("set repository-local core.hooksPath");
	expect(installed.stdout).toContain("chaining global pre-commit hook");
	expect(hooks.run("status").status).toBe(0);
	expect(git.commit().status).toBe(0);
	expect(recorded.qualityLog()).toBe("quality\n");
	expect(recorded.globalLog()).toBe("global\n");
	expect(recorded.globalConfig()).toBe(before);
});

hookStory.it("blocks a commit when the global guard fails and still runs Quality", [globalHook(7)], ({ git, hooks, recorded }) => {
	expect(hooks.run("install").status).toBe(0);
	const exitCode = git.commit().status;
	expect(exitCode).toBe(1);
	expect(recorded.globalLog()).toBe("global\n");
	expect(recorded.qualityLog()).toBe("quality\n");
});

hookStory.it("runs Quality alone without a global hooks path", [], ({ git, hooks, recorded }) => {
	expect(hooks.run("install").stdout).toContain("no executable global pre-commit hook to chain");
	expect(git.commit().status).toBe(0);
	expect(recorded.qualityLog()).toBe("quality\n");
	expect(recorded.globalLog()).toBe("");
});

hookStory.it("ignores a non-executable global hook", [globalHook(7, false)], ({ git, hooks, recorded }) => {
	expect(hooks.run("install").stdout).toContain("no executable global pre-commit hook to chain");
	expect(git.commit().status).toBe(0);
	expect(recorded.qualityLog()).toBe("quality\n");
	expect(recorded.globalLog()).toBe("");
});

hookStory.it(
	"resolves a relative global path from the committing worktree root",
	[globalHook(0, true, ".global-hooks")],
	({ git, hooks, recorded }) => {
		expect(hooks.run("install").status).toBe(0);
		expect(git.commit().status).toBe(0);
		expect(recorded.globalLog()).toBe("global\n");
		expect(recorded.qualityLog()).toBe("quality\n");
	},
);

hookStory.it("reports an effective hooks path that stops running Quality", [], ({ git, hooks }) => {
	let exitCode = hooks.run("status").status;
	expect(exitCode).toBe(1);
	expect(hooks.run("install").status).toBe(0);
	expect(git.config("--local", "core.hooksPath", ".other-hooks").status).toBe(0);
	const status = hooks.run("status");
	exitCode = status.status;
	expect(exitCode).toBe(1);
	expect(status.stderr).toContain("does not run Quality's pre-commit hook");
});

hookStory.it("restores global hooks on uninstall", [globalHook()], ({ git, hooks, recorded }) => {
	const before = recorded.globalConfig();
	expect(hooks.run("install").status).toBe(0);
	expect(hooks.run("uninstall").status).toBe(0);
	const exitCode = git.config("--local", "--get", "core.hooksPath").status;
	expect(exitCode).toBe(1);
	expect(git.commit().status).toBe(0);
	expect(recorded.qualityLog()).toBe("");
	expect(recorded.globalLog()).toBe("global\n");
	expect(recorded.globalConfig()).toBe(before);
});
