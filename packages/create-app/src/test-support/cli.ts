import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Config, Effect } from "effect";

const folders: string[] = [];
const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));

export function appFolder({
	installationExit = 0,
	destination = "absent",
}: {
	readonly installationExit?: number;
	readonly destination?: "absent" | "empty" | "file" | "nonempty";
} = {}) {
	const root = mkdtempSync(join(tmpdir(), "create-app-cli-"));
	folders.push(root);
	const bin = join(root, "bin");
	mkdirSync(bin);
	writeFileSync(
		join(bin, "pnpm"),
		`#!/usr/bin/env node\nrequire('node:fs').writeFileSync('installation.json', JSON.stringify(process.argv.slice(2)));\nprocess.exit(${installationExit});\n`,
		{ mode: 0o755 },
	);
	const target = join(root, "my-app");
	if (["empty", "nonempty"].includes(destination)) {
		mkdirSync(target);
	}
	if (destination === "nonempty") {
		writeFileSync(join(target, ".keep"), "user data");
	}
	if (destination === "file") {
		writeFileSync(target, "user data");
	}
	const path = Effect.runSync(Config.string("PATH"));
	return {
		root,
		run: (args: readonly string[]) =>
			spawnSync("env", [`PATH=${bin}:${path}`, "NODE_OPTIONS=", process.execPath, "--conditions=source", cli, ...args], {
				cwd: root,
				encoding: "utf8",
			}),
	};
}

export function cleanup() {
	for (const folder of folders.splice(0)) {
		rmSync(folder, { force: true, recursive: true });
	}
}
