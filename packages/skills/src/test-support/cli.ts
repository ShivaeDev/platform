import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

export interface CliRun {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

const repos: string[] = [];

export function consumerRepo(selection: readonly string[]): string {
	const repo = mkdtempSync(join(tmpdir(), "skills-cli-"));
	repos.push(repo);
	writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "consumer", shivaedevSkills: selection }));
	return repo;
}

export function removeConsumerRepos(): void {
	for (const repo of repos.splice(0)) {
		rmSync(repo, { force: true, recursive: true });
	}
}

export function runCli(repo: string, args: readonly string[]): CliRun {
	const { status, stderr, stdout } = spawnSync(process.execPath, ["--conditions=source", CLI, ...args], { cwd: repo, encoding: "utf8" });
	return { status, stderr, stdout };
}
