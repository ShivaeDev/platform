import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { Schema } from "effect";
import rawTrees from "../fixtures/cli-trees.json" with { type: "json" };
import { packageRoot } from "./tree.ts";

const SeedFile = Schema.Struct({ content: Schema.String, path: Schema.String });

export const trees = Schema.decodeUnknownSync(
	Schema.Struct({ clean: Schema.Array(SeedFile), dirty: Schema.Array(SeedFile), warned: Schema.Array(SeedFile) }),
)(rawTrees);

export interface Run {
	readonly status: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

/** Runs the command line from source, as Platform does, resolving the package's own imports through its source condition. */
export const quality = (root: string, ...args: ReadonlyArray<string>): Run => {
	const result = spawnSync("node", ["--conditions=source", join(packageRoot, "src", "cli.ts"), ...args], { cwd: root, encoding: "utf8" });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};
