import { join } from "node:path";
import { Config, Effect, FileSystem } from "effect";
import { command } from "#package-check/io.ts";

export const packedInstaller = Effect.fn("Published.packedInstaller")(function* (
	root: string,
	temporary: string,
	tarballs: Readonly<Record<string, string>>,
) {
	const fs = yield* FileSystem.FileSystem;
	const directory = join(temporary, "installer");
	const pnpm = (yield* command(root, "which", ["pnpm"])).trim();
	yield* fs.makeDirectory(directory);
	const shim = join(directory, "pnpm");
	yield* fs.writeFileString(
		shim,
		`#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { withTarballOverrides } from ${JSON.stringify(join(root, "script/withTarballOverrides.ts"))};
const workspace = join(process.cwd(), "pnpm-workspace.yaml");
writeFileSync(workspace, withTarballOverrides(readFileSync(workspace, "utf8"), ${JSON.stringify(tarballs)}));
const result = spawnSync(${JSON.stringify(pnpm)}, process.argv.slice(2), { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
`,
	);
	yield* fs.chmod(shim, 0o755);
	return `${directory}:${yield* Config.String("PATH")}`;
});
