import { execFileSync, spawnSync } from "node:child_process";
import { Config, Effect, Option } from "effect";

const HEAVY_ENV = Object.fromEntries(
	["CI", "HOME", "HEAVY_PROCESS_LOCK", "HEAVY_PROCESS_LOCK_ID"].flatMap((name) =>
		Option.toArray(Effect.runSync(Config.option(Config.String(name)))).map((value) => [name, value]),
	),
);

// Git reads no user or system config, so a machine-wide hooks path neither runs nor hides a hook under test, and no GIT_DIR or
// GIT_INDEX_FILE from a hook that runs the tests points git at the outer repository.
export const ISOLATED_ENV = {
	...HEAVY_ENV,
	"GIT_AUTHOR_EMAIL": "quality@example.invalid",
	"GIT_AUTHOR_NAME": "Quality",
	"GIT_COMMITTER_EMAIL": "quality@example.invalid",
	"GIT_COMMITTER_NAME": "Quality",
	"GIT_CONFIG_GLOBAL": "/dev/null",
	"GIT_CONFIG_NOSYSTEM": "1",
	"PATH": Effect.runSync(Config.String("PATH")),
};

const SETTINGS = [
	"user.name=Quality",
	"user.email=quality@example.invalid",
	"init.defaultBranch=main",
	"commit.gpgsign=false",
	"core.hooksPath=/dev/null",
];

export function git(root: string, ...args: readonly string[]): string {
	return execFileSync("git", [...SETTINGS.flatMap((setting) => ["-c", setting]), ...args], {
		cwd: root,
		encoding: "utf8",
		env: ISOLATED_ENV,
		stdio: ["ignore", "pipe", "pipe"],
	});
}

export function commitAll(root: string, message: string): void {
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "--message", message);
}

export function mergeBranch(root: string, branch: string): "merged" | "conflicted" {
	const result = spawnSync("git", [...SETTINGS.flatMap((setting) => ["-c", setting]), "merge", "--quiet", "--no-edit", branch], {
		cwd: root,
		encoding: "utf8",
		env: ISOLATED_ENV,
	});
	if (result.status !== 0 && result.status !== 1) {
		throw new Error(`git merge failed: ${result.error ?? result.stderr}`);
	}
	return result.status === 0 ? "merged" : "conflicted";
}

export function branchOff(root: string): string {
	git(root, "init", "--quiet");
	commitAll(root, "Base");
	git(root, "switch", "--quiet", "--create", "work");
	return root;
}
