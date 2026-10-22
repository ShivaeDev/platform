import { execFileSync } from "node:child_process";

export function git(root: string, ...args: readonly string[]) {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

export function initRepository(root: string, ...args: readonly string[]) {
	execFileSync("git", ["init", "-b", "main", ...args, root], { stdio: "pipe" });
	// Detached maintenance can outlive synchronous git calls and race scoped directory removal.
	git(root, "config", "maintenance.auto", "false");
	git(root, "config", "gc.auto", "0");
}
