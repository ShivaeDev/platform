import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { Schema } from "effect";
import rawTrees from "#test/fixtures/cli-trees.json" with { type: "json" };
import { packageRoot } from "./tree.ts";

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
function cliArgs(args: readonly string[]): string[] {
	return ["--conditions=source", join(packageRoot, "src", "cli.ts"), ...args];
}

export function quality(root: string, ...args: readonly string[]): Run {
	const result = spawnSync("node", cliArgs(args), { cwd: root, encoding: "utf8" });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

export function qualityWithin(timeout: number, root: string, ...args: readonly string[]): Promise<Run> {
	return new Promise((resolve) => {
		const child = spawn("node", cliArgs(args), { cwd: root, detached: true });
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
