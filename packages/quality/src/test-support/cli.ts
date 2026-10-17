import { spawn, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { format } from "node:util";
import { Console, Effect, Schema } from "effect";
import { vi } from "vitest";
import { program } from "#cli/program.ts";
import { exitCode, explained, services } from "#cli/run-main.ts";
import rawTrees from "#test/fixtures/cli-trees.json" with { type: "json" };
import { ISOLATED_ENV } from "#test/git.ts";
import { packageRoot } from "#test/tree.ts";

const SeedFile = Schema.Struct({ content: Schema.String, path: Schema.String });

export const trees = Schema.decodeUnknownSync(Schema.Struct({ clean: Schema.Array(SeedFile), dirty: Schema.Array(SeedFile) }))(rawTrees);

export interface Run {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

const CLI = join(packageRoot, "src", "cli.ts");

// The source condition resolves a seeded config's import of the package to its source, so tests need no build.
export function qualityArgs(args: readonly string[]): string[] {
	return ["--conditions=source", CLI, ...args];
}

function isolateGit(): void {
	for (const name of ["GIT_COMMON_DIR", "GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"]) {
		vi.stubEnv(name, undefined);
	}
	for (const [name, value] of Object.entries(ISOLATED_ENV)) {
		vi.stubEnv(name, value);
	}
}

// Runs the executable's program in this process, which imports each config path once: after a command rewrites the config, spawn `quality`.
export async function runQuality(root: string, ...args: readonly string[]): Promise<Run> {
	const output = { stderr: "", stdout: "" };
	const captured: Console.Console = Object.assign(Object.create(console), {
		error: (...parts: readonly unknown[]) => {
			output.stderr += `${format(...parts)}\n`;
		},
		log: (...parts: readonly unknown[]) => {
			output.stdout += `${format(...parts)}\n`;
		},
	});
	const command = program(args, { cwd: realpathSync(root), launch: { options: ["--conditions=source"], script: CLI } });
	isolateGit();
	try {
		const exit = await Effect.runPromiseExit(explained(command).pipe(Effect.provideService(Console.Console, captured), Effect.provide(services)));
		return { status: exitCode(exit), ...output };
	} finally {
		vi.unstubAllEnvs();
	}
}

export function quality(root: string, ...args: readonly string[]): Run {
	const result = spawnSync("node", qualityArgs(args), { cwd: root, encoding: "utf8", env: ISOLATED_ENV });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

export function qualityWithin(timeout: number, root: string, ...args: readonly string[]): Promise<Run> {
	return new Promise((resolve) => {
		const child = spawn("node", qualityArgs(args), { cwd: root, detached: true, env: ISOLATED_ENV });
		const output = { stderr: "", stdout: "" };
		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			output.stdout += chunk;
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			output.stderr += chunk;
		});
		const timer = setTimeout(() => {
			if (child.pid !== undefined) {
				process.kill(-child.pid, "SIGKILL");
			}
		}, timeout);
		child.on("close", (status) => {
			clearTimeout(timer);
			resolve({ status, ...output });
		});
	});
}

export function interruptedQuality(root: string): Promise<Run> {
	return new Promise((resolve, reject) => {
		const child = spawn("node", qualityArgs(["lint"]), { cwd: root, env: ISOLATED_ENV });
		const output = { stderr: "", stdout: "" };
		let interrupted = false;
		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			output.stdout += chunk;
			if (!interrupted && output.stdout.includes("checking remote\n")) {
				interrupted = true;
				child.kill("SIGINT");
			}
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			output.stderr += chunk;
		});
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error("quality did not begin its remote check before interruption"));
		}, 10_000);
		child.on("error", reject);
		child.on("close", (status) => {
			clearTimeout(timer);
			if (!interrupted) {
				reject(new Error(`quality exited before interruption: ${JSON.stringify({ status, ...output })}`));
				return;
			}
			resolve({ status, ...output });
		});
	});
}
