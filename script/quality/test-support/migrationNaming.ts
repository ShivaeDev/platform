import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { loadConfig } from "@shivaedev/quality/config/load.ts";
import { runRules } from "@shivaedev/quality/engine/runRules.ts";
import type { Violation } from "@shivaedev/quality/engine/violation.ts";
import { collectInventory } from "@shivaedev/quality/inventory/collect.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { type SeedFile, seedTree } from "#quality-fixtures/tree.ts";

interface Repository {
	root: string;
	violations: readonly Violation[];
}

export const migrationNaming = storyKit({
	clock: "live",
	create: (): Repository => ({ root: seedTree([]), violations: [] }),
	layer: NodeFileSystem.layer,
	name: "tool-owned migration names",
	stages: ["authored"],
	verbs: (engine, story) => ({
		checkNames: Effect.fn("MigrationNaming.checkNames")(function* () {
			story.tell("check file and folder names with Quality's default config");
			const config = yield* loadConfig(engine.root, undefined);
			const inventory = yield* collectInventory(engine.root, config);
			engine.violations = yield* runRules(
				config.active.filter((rule) => rule.id.startsWith("files/")),
				{ ...inventory, readText: (path) => readFile(join(engine.root, path), "utf8"), root: engine.root },
			);
		}),
		violations: () => engine.violations.map(({ file, rule }) => ({ file, rule })),
	}),
});

export function namingFiles(files: readonly SeedFile[]) {
	return migrationNaming.trait("authored", "a repository contains migrations and authored neighbours", (engine) => {
		engine.root = seedTree([{ content: '{"type":"module"}', path: "package.json" }], files);
	});
}
