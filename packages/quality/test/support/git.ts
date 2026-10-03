import { execFileSync } from "node:child_process";

const SETTINGS = [
	"user.name=Quality",
	"user.email=quality@example.invalid",
	"init.defaultBranch=main",
	"commit.gpgsign=false",
	"core.hooksPath=/dev/null",
];

export const git = (root: string, ...args: readonly string[]): string =>
	execFileSync("git", [...SETTINGS.flatMap((setting) => ["-c", setting]), ...args], {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

export const commitAll = (root: string, message: string): void => {
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "--message", message);
};

export const branchOff = (root: string): string => {
	git(root, "init", "--quiet");
	commitAll(root, "Base");
	git(root, "switch", "--quiet", "--create", "work");
	return root;
};
