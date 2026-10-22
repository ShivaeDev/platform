import { join } from "node:path";
import { FileSystem } from "effect";
import { claudePluginFolder } from "#lib/test-support/claudePluginFolder.ts";
import { writeJson } from "#package-check/io.ts";
import { archives } from "./archives.ts";

export const privateAddon = archives.trait("workspace", "a private addon awaits release authorization", function* ({ root }) {
	const directory = join(root, "packages/addon");
	yield* (yield* FileSystem.FileSystem).makeDirectory(directory);
	yield* writeJson(join(directory, "package.json"), { name: "@example/addon", private: true, version: "0.0.0" });
});

export const claudePlugin = archives.trait("workspace", "the workspace also contains a Claude Code plugin", ({ root }) => {
	claudePluginFolder(join(root, "packages/plugin"));
});
