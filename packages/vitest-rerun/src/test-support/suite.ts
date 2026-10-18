import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Console, Effect, FileSystem } from "effect";
import { vi } from "vitest";
import { main } from "#internal/main.ts";
import { type Merged, mergeAttempt } from "#internal/mergeAttempt.ts";
import { attemptPaths } from "#internal/reportPaths.ts";
import { readSnapshot, type Snapshot, tests } from "#internal/snapshot.ts";
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
	const run: Run = { output, status };
	return run;
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
		child.on("close", (status) => resolve({ output, status }));
	});
}

export const recordAttempt = Effect.fn("VitestRerunSuite.recordAttempt")(function* (suite: Suite) {
	yield* runProgram(suite, ["--reruns", "0"]);
	return yield* readSnapshot(attemptPaths(join(suite.directory, REPORTS), 1).snapshot);
});

export interface MergedAttempt extends Merged, Snapshot {
	readonly summary: readonly string[];
}

export function mergeAttempts(suite: Suite, previous: Snapshot, rerun: Snapshot): MergedAttempt {
	const summary: string[] = [];
	const merged = mergeAttempt(previous, rerun.files, realpathSync(suite.directory), (line) => summary.push(line));
	return { ...merged, errors: rerun.errors, summary };
}

export function states(snapshot: Snapshot): Readonly<Record<string, string | undefined>> {
	return Object.fromEntries(
		snapshot.files.flatMap((file) => [
			[file.name, file.result?.state],
			...tests(file.tasks).map((test) => [`${file.name} > ${test.name}`, test.result?.state]),
		]),
	);
}

export function duration(snapshot: Snapshot, name: string): number | undefined {
	return snapshot.files.flatMap((file) => tests(file.tasks)).find((test) => test.name === name)?.result?.duration;
}
