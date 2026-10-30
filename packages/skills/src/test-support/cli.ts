import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

export interface ProcessRun {
	readonly exit: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

export function exec(command: string, args: readonly string[], cwd: string): ProcessRun {
	const { status, stderr, stdout } = spawnSync(command, args, { cwd, encoding: "utf8" });
	return { exit: status, stderr, stdout };
}

export function runCli(repo: string, args: readonly string[]): ProcessRun {
	return exec(process.execPath, ["--conditions=source", CLI, ...args], repo);
}
