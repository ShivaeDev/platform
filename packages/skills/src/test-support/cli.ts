import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

export interface CliRun {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

export function runCli(repo: string, args: readonly string[]): CliRun {
	const { status, stderr, stdout } = spawnSync(process.execPath, ["--conditions=source", CLI, ...args], { cwd: repo, encoding: "utf8" });
	return { status, stderr, stdout };
}
