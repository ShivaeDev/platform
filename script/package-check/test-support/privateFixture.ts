import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudePluginFolder } from "#lib/test-support/claudePluginFolder.ts";

export function privateFixture() {
	const root = mkdtempSync(join(tmpdir(), "private-package-"));
	const directory = join(root, "packages", "addon");
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "@example/addon", private: true, version: "0.0.0" }));
	return {
		plugin: (name: string) => claudePluginFolder(join(root, "packages", name)),
		remove: () => rmSync(root, { force: true, recursive: true }),
		root,
	};
}
