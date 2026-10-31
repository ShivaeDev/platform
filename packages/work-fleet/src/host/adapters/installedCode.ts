import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunningCode } from "#host/supervisorCode.ts";
import { codeDigest } from "./codeDigest.ts";

export function packageManifest(name: string, from: string) {
	for (const directory of createRequire(from).resolve.paths(name) ?? []) {
		const file = join(directory, name, "package.json");
		if (existsSync(file)) {
			return file;
		}
	}
	throw new Error(`Cannot resolve ${name} from ${from}`);
}

export function installedCode(boardDir: string) {
	let fleet: string;
	try {
		fleet = packageManifest("@shivaedev/work-fleet", join(boardDir, "package.json"));
	} catch {
		fleet = fileURLToPath(new URL("../../../package.json", import.meta.url));
	}
	function code(manifest: string, entry: string): RunningCode {
		const file = join(dirname(realpathSync(manifest)), import.meta.url.endsWith(".ts") ? `src/${entry}.ts` : `dist/${entry}.js`);
		return { entry: file, manifest, revision: `sha256:${codeDigest(file)}` };
	}
	return { board: code(packageManifest("@shivaedev/work-board", fleet), "server/cli"), daemon: code(fleet, "cli") };
}
