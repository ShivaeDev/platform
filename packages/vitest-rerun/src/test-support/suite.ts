import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem } from "effect";
import { type SuiteConfig, vitestConfig } from "./specFiles.ts";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));
export const REPORTS = "reports";

export const createSuite = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const directory = yield* fs.makeTempDirectoryScoped({ prefix: "vitest-rerun-" });
	const config: SuiteConfig = { coverage: false, projects: [] };
	return { config, directory };
});

export type Suite = Effect.Success<typeof createSuite>;

export interface Run {
	readonly output: string;
	readonly status: number | null;
}

export function writeFile(suite: Suite, path: string, contents: string): void {
	writeFileSync(join(suite.directory, path), contents);
}

export function readFile(suite: Suite, path: string): string | undefined {
	const file = join(suite.directory, path);
	return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

export function listFiles(suite: Suite): readonly string[] {
	return readdirSync(suite.directory, { encoding: "utf8", recursive: true })
		.filter((path) => !path.startsWith(".vite"))
		.sort();
}

export function runCli(suite: Suite, args: readonly string[]): Promise<Run> {
	writeFile(suite, "vitest.config.ts", vitestConfig(suite.directory, suite.config));
	const child = spawn(process.execPath, ["--conditions=source", CLI, "--output-dir", REPORTS, ...args], {
		cwd: suite.directory,
		env: { "GITHUB_STEP_SUMMARY": join(suite.directory, "summary.md") },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
		output += chunk;
	});
	child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
		output += chunk;
	});
	return new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("close", (status) => resolve({ output, status }));
	});
}
