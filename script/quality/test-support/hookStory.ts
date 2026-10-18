import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync, realpathSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { qualityArgs } from "#quality-fixtures/cli.ts";
import { ISOLATED_ENV } from "#quality-fixtures/git.ts";
import { checksLog, hookRepository, logs, withScripts, writes } from "#quality-fixtures/hookRepository.ts";
import { seedTree } from "#quality-fixtures/tree.ts";

export const hookStory = storyKit({
	clock: "live",
	create: () => {
		const repository = hookRepository({ folder: "app", scripts: { typecheck: logs("quality") } });
		const global = join(seedTree([]), "global config");
		writes(global, "gitconfig", "");
		return { ...repository, global };
	},
	name: "quality hooks",
	stages: ["git"],
	verbs: (repository, story) => {
		const env = { ...ISOLATED_ENV, "GIT_CONFIG_GLOBAL": join(repository.global, "gitconfig") };
		function run(command: string, args: readonly string[], cwd = repository.root) {
			story.tell(`${command} ${args.join(" ")}`);
			const result = spawnSync(command, [...args], { cwd, encoding: "utf8", env, timeout: 30_000 });
			if (result.error !== undefined) {
				throw result.error;
			}
			return { status: result.status, stderr: result.stderr, stdout: result.stdout };
		}
		return {
			git: {
				commit: () => run("git", ["commit", "--allow-empty", "-m", "Checked"]),
				config: (...args: string[]) => run("git", ["config", ...args]),
			},
			hooks: {
				run: (...args: string[]) => run("node", qualityArgs(["hooks", ...args]), join(repository.root, repository.folder)),
			},
			recorded: {
				globalConfig: () => readFileSync(env.GIT_CONFIG_GLOBAL, "utf8"),
				globalLog: () => checksLog(repository.root),
				qualityLog: () => checksLog(join(repository.root, repository.folder)),
			},
		};
	},
});

export function qualityFails() {
	return hookStory.trait("git", "Quality's typecheck fails", (repository) => {
		withScripts(join(repository.root, repository.folder), { typecheck: `${logs("quality")}; exit 3` });
	});
}

export function includedGlobalConfig(kind: "include" | "includeIf") {
	return hookStory.trait("git", `the global hook configuration comes from ${kind}`, (repository) => {
		renameSync(join(repository.global, "gitconfig"), join(repository.global, "guard.gitconfig"));
		const section = kind === "include" ? "include" : `includeIf "gitdir:${realpathSync(repository.root)}/.git"`;
		writes(repository.global, "gitconfig", `[${section}]\n\tpath = guard.gitconfig\n`);
	});
}

export function globalHook(exit = 0, executable = true, path?: string) {
	return hookStory.trait("git", `a ${executable ? "executable" : "non-executable"} global hook exits ${exit}`, (repository) => {
		const directory = path ?? join(repository.global, "hooks with spaces");
		writes(resolve(repository.root, directory), "pre-commit", `#!/bin/sh\n${logs("global")}\nexit ${exit}\n`);
		const file = resolve(repository.root, directory, "pre-commit");
		chmodSync(file, executable ? 0o755 : 0o644);
		const result = spawnSync("git", ["config", "--global", "core.hooksPath", directory], {
			cwd: repository.root,
			encoding: "utf8",
			env: { ...ISOLATED_ENV, "GIT_CONFIG_GLOBAL": join(repository.global, "gitconfig") },
		});
		if (result.status !== 0) {
			throw new Error(result.stderr);
		}
	});
}
