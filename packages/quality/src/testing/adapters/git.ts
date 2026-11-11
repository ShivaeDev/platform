import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { Config, Effect, Option } from "effect";
import { isolatedGitEnvironment } from "@shivaedev/test-story/server/adapters/isolatedGit.ts";

const INHERITED = Object.fromEntries(
	["HOME", "HEAVY_PROCESS_LOCK", "HEAVY_PROCESS_LOCK_ID", "PATH"].flatMap((name) =>
		Option.toArray(Effect.runSync(Config.option(Config.String(name)))).map((value) => [name, value]),
	),
);

export const qualityGitEnvironment = isolatedGitEnvironment({
	"GIT_AUTHOR_EMAIL": "quality@example.invalid",
	"GIT_AUTHOR_NAME": "Quality",
	"GIT_COMMITTER_EMAIL": "quality@example.invalid",
	"GIT_COMMITTER_NAME": "Quality",
});

export function isolatedEnvironment(root: string) {
	return { ...INHERITED, ...qualityGitEnvironment, "HEAVY_PROCESS_LOCK": resolve(root, "heavy.lock") };
}

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
		env: isolatedEnvironment(root),
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
		env: isolatedEnvironment(root),
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
