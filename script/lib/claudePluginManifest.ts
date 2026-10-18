import { join } from "node:path";

// A workspace folder holding this manifest is a Claude Code plugin, which ships from the plugin marketplace rather than npm.
export function claudePluginManifest(directory: string): string {
	return join(directory, ".claude-plugin", "plugin.json");
}
