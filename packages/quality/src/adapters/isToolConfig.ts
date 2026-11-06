import { posix } from "node:path";
import preset from "#biome-preset" with { type: "json" };

const PATTERNS = preset.overrides.flatMap((override) =>
	override.includes.includes("**/*.config.*") && override.linter?.rules?.style?.noDefaultExport === "off" ? override.includes : [],
);

export function isToolConfig(path: string): boolean {
	return PATTERNS.some((pattern) => posix.matchesGlob(path, pattern));
}
