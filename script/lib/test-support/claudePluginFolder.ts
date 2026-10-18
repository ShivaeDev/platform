import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { claudePluginManifest } from "#lib/claudePluginManifest.ts";

export function claudePluginFolder(directory: string): void {
	const name = basename(directory);
	mkdirSync(dirname(claudePluginManifest(directory)), { recursive: true });
	writeFileSync(join(directory, "package.json"), JSON.stringify({ name, private: true, version: "0.0.0" }));
	writeFileSync(claudePluginManifest(directory), JSON.stringify({ name }));
}
