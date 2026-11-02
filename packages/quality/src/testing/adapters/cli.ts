import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format } from "node:util";
import { Config, Console, Effect, Option } from "effect";
import { program } from "#cli/program.ts";
import { exitCode, explained, services } from "#cli/runMain.ts";
import { ISOLATED_ENV } from "#testing/adapters/git.ts";

export interface Run {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

const SOURCE = import.meta.url.endsWith(".ts");
const CLI = fileURLToPath(new URL(SOURCE ? "../../cli.ts" : "../../cli.js", import.meta.url));
const OPTIONS = SOURCE ? ["--conditions=source"] : [];

export const CLI_TIMEOUT = 60_000;

// The source condition resolves a seeded config's import of the package to its source, so tests need no build.
export function qualityArgs(args: readonly string[]): string[] {
	return [...OPTIONS, CLI, ...args];
}

const ISOLATED: readonly (readonly [string, string | undefined])[] = [
	...["GIT_COMMON_DIR", "GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"].map((name) => [name, undefined] as const),
	...Object.entries(ISOLATED_ENV),
];

async function isolateGit(): Promise<() => void> {
	const { vi } = await import("vitest");
	const previous = ISOLATED.map(([name]) => [name, Option.getOrUndefined(Effect.runSync(Config.option(Config.String(name))))] as const);
	for (const [name, value] of ISOLATED) {
		vi.stubEnv(name, value);
	}
	return () => {
		for (const [name, value] of previous) {
			vi.stubEnv(name, value);
		}
	};
}

export interface Output {
	stderr: string;
	stdout: string;
}

function writer(output: Output, stream: keyof Output): (...parts: readonly unknown[]) => void {
	return (...parts) => {
		output[stream] += `${format(...parts)}\n`;
	};
}

function unsupported(): never {
	throw new Error("The captured Console copies only the output methods; capture this one too before quality calls it.");
}

export function capturing(output: Output): Console.Console {
	const stdout = writer(output, "stdout");
	const stderr = writer(output, "stderr");
	return {
		assert: unsupported,
		clear: unsupported,
		count: unsupported,
		countReset: unsupported,
		debug: stdout,
		dir: unsupported,
		dirxml: unsupported,
		error: stderr,
		group: unsupported,
		groupCollapsed: unsupported,
		groupEnd: unsupported,
		info: stdout,
		log: stdout,
		table: unsupported,
		time: unsupported,
		timeEnd: unsupported,
		timeLog: unsupported,
		trace: stderr,
		warn: stderr,
	};
}

// Runs the executable's program in this process, which imports each config path once: after a command rewrites the config, spawn `quality`.
export async function runQuality(root: string, ...args: readonly string[]): Promise<Run> {
	const output: Output = { stderr: "", stdout: "" };
	const captured = capturing(output);
	const command = program(args, { cwd: realpathSync(root), launch: { options: OPTIONS, script: CLI } });
	const restore = await isolateGit();
	try {
		const exit = await Effect.runPromiseExit(explained(command).pipe(Effect.provideService(Console.Console, captured), Effect.provide(services)));
		return { status: exitCode(exit), ...output };
	} finally {
		restore();
	}
}

export function quality(root: string, ...args: readonly string[]): Run {
	const result = spawnSync("node", qualityArgs(args), { cwd: root, encoding: "utf8", env: ISOLATED_ENV });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

export const CLI_EXIT = { invalid: 2, passed: 0, rejected: 1 } as const;
