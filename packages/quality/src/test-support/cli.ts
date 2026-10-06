import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { Schema } from "effect";
import rawTrees from "#test/fixtures/cli-trees.json" with { type: "json" };
import { ISOLATED_ENV } from "#test/git.ts";
import { packageRoot } from "#test/tree.ts";

const SeedFile = Schema.Struct({ content: Schema.String, path: Schema.String });

export const trees = Schema.decodeUnknownSync(
	Schema.Struct({ clean: Schema.Array(SeedFile), dirty: Schema.Array(SeedFile), warned: Schema.Array(SeedFile) }),
)(rawTrees);

export interface Run {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

// The source condition resolves a seeded config's import of the package to its source, so tests need no build.
export function qualityArgs(args: readonly string[]): string[] {
	return ["--conditions=source", join(packageRoot, "src", "cli.ts"), ...args];
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
