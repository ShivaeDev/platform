import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format } from "node:util";
import { Config, ConfigProvider, Console, Effect, Option } from "effect";
import { exitCode, explained, services } from "#adapters/runMain.ts";
import { program } from "#cli/program.ts";
import { isolatedEnvironment, qualityGitEnvironment } from "#testing/adapters/git.ts";

export interface Run {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

const SOURCE = import.meta.url.endsWith(".ts");
const CLI = fileURLToPath(new URL(SOURCE ? "../../cli.ts" : "../../cli.js", import.meta.url));
const OPTIONS = SOURCE ? ["--conditions=@shivaedev/source"] : [];

export const CLI_TIMEOUT = 60_000;

// The source condition resolves a seeded config's import of the package to its source, so tests need no build.
export function qualityArgs(args: readonly string[]): string[] {
	return [...OPTIONS, CLI, ...args];
}

const ISOLATED: readonly (readonly [string, string | undefined])[] = [["CLAUDE_CODE_REMOTE", undefined], ...Object.entries(qualityGitEnvironment)];

const RUN_SET_VARIABLES: ReadonlySet<string> = new Set(["CI", "CLAUDE_CODE_REMOTE"]);

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

// Runs the executable's program in this process, which imports each config path once: after a command rewrites the config, spawn `quality`. The host's CI and cloud session variables would choose the rule set, so only the given variables do.
export function runQualityWith(root: string, variables: Readonly<Record<string, string>>, ...args: readonly string[]): Effect.Effect<Run> {
	return Effect.scoped(
		Effect.gen(function* () {
			const output: Output = { stderr: "", stdout: "" };
			const command = program(args, { cwd: realpathSync(root), launch: { options: OPTIONS, script: CLI } });
			const host = yield* ConfigProvider.ConfigProvider;
			const environment = ConfigProvider.orElse(
				ConfigProvider.fromEnv({ env: { ...variables, "HEAVY_PROCESS_LOCK": isolatedEnvironment(root).HEAVY_PROCESS_LOCK } }),
				ConfigProvider.make((path) => (RUN_SET_VARIABLES.has(path.join("_")) ? Effect.succeed(undefined) : host.load(path))),
			);
			yield* Effect.acquireRelease(Effect.promise(isolateGit), (restore) => Effect.sync(restore));
			const exit = yield* explained(command).pipe(
				Effect.provideService(ConfigProvider.ConfigProvider, environment),
				Effect.provideService(Console.Console, capturing(output)),
				Effect.provide(services),
				Effect.exit,
			);
			return { status: exitCode(exit), ...output };
		}),
	);
}

export function runQuality(root: string, ...args: readonly string[]): Effect.Effect<Run> {
	return runQualityWith(root, {}, ...args);
}

export function quality(root: string, ...args: readonly string[]): Run {
	const result = spawnSync("node", qualityArgs(args), { cwd: root, encoding: "utf8", env: isolatedEnvironment(root) });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

export const CLI_EXIT = { invalid: 2, passed: 0, rejected: 1 } as const;
