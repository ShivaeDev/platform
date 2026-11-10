import { posix } from "node:path";
import preset from "#biome-preset" with { type: "json" };

const PATTERNS = [
	...preset.overrides.flatMap((override) =>
		override.includes.includes("**/*.config.*") && override.linter?.rules?.style?.noDefaultExport === "off" ? override.includes : [],
	),
	// @shivaedev/deploy loads this module from its default path, so no import reaches it.
	"**/.railway/postgres-schedules.ts",
];

export function isToolConfig(path: string): boolean {
	return PATTERNS.some((pattern) => posix.matchesGlob(path, pattern));
}
