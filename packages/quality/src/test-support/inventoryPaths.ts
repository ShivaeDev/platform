import { Effect } from "effect";
import { collectInventory } from "#inventory/collect.ts";
import type { SeedFile } from "#test/tree.ts";

export function sourceFiles(paths: readonly string[]): readonly SeedFile[] {
	return paths.map((path) => ({ content: "export const value = 1;\n", path }));
}

export function pathsOf(root: string, sources: readonly string[] = ["."]) {
	return Effect.map(collectInventory(root, { exclude: [], extensions: [".ts"], sources }), (inventory) =>
		inventory.sources.map((source) => source.path),
	);
}
