import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { vi } from "@effect/vitest";
import { Config, Console, Deferred, Effect, type Fiber, FileSystem } from "effect";
import { DEFAULT_OUTPUT_DIR } from "#defaults.ts";
import { main } from "#main.ts";
import { type SuiteConfig, vitestConfig } from "#test/specFiles.ts";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));
const QUALITY = fileURLToPath(import.meta.resolve("@shivaedev/quality/cli.ts"));
const SOURCE = "--conditions=@shivaedev/source";
const PASSING_STEP = 'node --eval ""';

export interface Run {
	readonly exitCode: number | null;
	readonly output: string;
}

export const createSuite = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const directory = yield* fs.makeTempDirectoryScoped({ prefix: "vitest-rerun-" });
	const config: SuiteConfig = { coverage: false, projects: [] };
	const runs: Run[] = [];
	const attemptPending = yield* Deferred.make<void>();
	const pendingRun: { fiber?: Fiber.Fiber<void, unknown> } = {};
	return { attemptPending, config, directory, pendingRun, runs };
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
	const status = yield* main(["--output-dir", DEFAULT_OUTPUT_DIR, ...args], suite.directory).pipe(
		Effect.provideService(Console.Console, captured),
		Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())),
	);
	suite.runs.push({ exitCode: status, output });
});

function spawnNode(suite: Suite, args: readonly string[], env: Readonly<Record<string, string>> = {}): Promise<Run> {
	writeFile(suite, "vitest.config.mts", vitestConfig(suite.directory, suite.config));
	const child = spawn(process.execPath, [SOURCE, ...args], {
		cwd: suite.directory,
		env: { "GITHUB_STEP_SUMMARY": summaryPath(suite), ...env, ...suite.config.env },
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

export function spawnCli(suite: Suite, args: readonly string[]): Promise<Run> {
	return spawnNode(suite, [CLI, "--output-dir", DEFAULT_OUTPUT_DIR, ...args]);
}

// The gate's other steps pass at once, so it reaches the test script, which runs vitest-rerun with its default output directory as the starter's does.
export const spawnQualityCi = Effect.fn("VitestRerunSuite.spawnQualityCi")(function* (suite: Suite) {
	const path = yield* Config.String("PATH");
	const scripts = { build: PASSING_STEP, lint: PASSING_STEP, test: `node ${SOURCE} ${JSON.stringify(CLI)}`, typecheck: PASSING_STEP };
	writeFile(suite, "package.json", JSON.stringify({ private: true, scripts, type: "module" }));
	return yield* Effect.promise(() => spawnNode(suite, [QUALITY, "ci", "--coverage"], { "PATH": path }));
});
