import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Console, Effect, FileSystem } from "effect";
import { vi } from "vitest";
import { main } from "#internal/main.ts";
import { type SuiteConfig, vitestConfig } from "./specFiles.ts";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));
export const REPORTS = "reports";

export interface Run {
	readonly exitCode: number | null;
	readonly output: string;
}

export const createSuite = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const directory = yield* fs.makeTempDirectoryScoped({ prefix: "vitest-rerun-" });
	const config: SuiteConfig = { coverage: false, projects: [] };
	const runs: Run[] = [];
	return { config, directory, runs };
});

export type Suite = Effect.Success<typeof createSuite>;

export function writeFile(suite: Suite, path: string, contents: string): void {
	writeFileSync(join(suite.directory, path), contents);
}

export function readFile(suite: Suite, path: string): string | undefined {
	const file = join(suite.directory, path);
	return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

export function listFiles(suite: Suite, directory = ""): readonly string[] {
	const root = join(suite.directory, directory);
	return existsSync(root) ? readdirSync(root, { encoding: "utf8", recursive: true }).sort() : [];
}

export function lastRun(suite: Suite): Run {
	const run = suite.runs.at(-1);
	if (run === undefined) {
		throw new Error("Run vitest-rerun before reading what it did");
	}
	return run;
}

function summaryPath(suite: Suite): string {
	return join(suite.directory, "summary.md");
}

// Runs the executable's program in this process so coverage sees it; each attempt still runs in its own process.
export const runProgram = Effect.fn("VitestRerunSuite.runProgram")(function* (suite: Suite, args: readonly string[]) {
	writeFile(suite, "vitest.config.mts", vitestConfig(suite.directory, suite.config));
	const console = yield* Console.Console;
	let output = "";
	const captured: Console.Console = {
		...console,
		error: (...parts) => {
			output += `${parts.join(" ")}\n`;
		},
	};
	vi.stubEnv("GITHUB_STEP_SUMMARY", summaryPath(suite));
	const status = yield* main(["--output-dir", REPORTS, ...args], suite.directory).pipe(
		Effect.provideService(Console.Console, captured),
		Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())),
	);
	suite.runs.push({ exitCode: status, output });
});

export function spawnCli(suite: Suite, args: readonly string[]): Promise<Run> {
	writeFile(suite, "vitest.config.mts", vitestConfig(suite.directory, suite.config));
	const child = spawn(process.execPath, ["--conditions=source", CLI, "--output-dir", REPORTS, ...args], {
		cwd: suite.directory,
		env: { "GITHUB_STEP_SUMMARY": summaryPath(suite) },
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
		child.on("close", (exitCode) => {
			const run: Run = { exitCode, output };
			suite.runs.push(run);
			resolve(run);
		});
	});
}
