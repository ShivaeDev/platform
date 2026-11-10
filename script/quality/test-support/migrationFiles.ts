import { Effect } from "effect";
import { services } from "@shivaedev/quality/adapters/runMain.ts";
import { typeScriptProgram } from "@shivaedev/quality/adapters/typeScriptProgram.ts";
import { biomeReport } from "@shivaedev/quality/biome/report.ts";
import { loadConfig } from "@shivaedev/quality/config/load.ts";
import { runRules } from "@shivaedev/quality/engine/runRules.ts";
import type { Violation } from "@shivaedev/quality/engine/violation.ts";
import { collectInventory } from "@shivaedev/quality/inventory/collect.ts";
import { manifestReader } from "@shivaedev/quality/manifestReader.ts";
import { linkPackage, type SeedFile, seedTree } from "@shivaedev/quality/testing/adapters/tree.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

interface Repository {
	defaultExports: readonly string[];
	root: string;
	violations: readonly Violation[];
}

export const migrationFiles = storyKit({
	create: (): Repository => ({ defaultExports: [], root: seedTree([]), violations: [] }),
	layer: services,
	name: "tool-owned migration files",
	stages: ["authored"],
	verbs: (engine, story) => ({
		checkNames: Effect.fn("MigrationFiles.checkNames")(function* () {
			story.tell("check file and folder names with Quality's default config");
			const config = yield* loadConfig(engine.root, undefined);
			const inventory = yield* collectInventory(engine.root, config);
			engine.violations = yield* runRules(
				config.active.filter((rule) => rule.id.startsWith("files/")),
				{
					...inventory,
					readText: yield* manifestReader(engine.root),
					root: engine.root,
					typeScript: yield* typeScriptProgram(engine.root, inventory.sources),
				},
			);
		}),
		defaultExports: () => engine.defaultExports,
		lintDefaultExports: Effect.fn("MigrationFiles.lintDefaultExports")(function* () {
			story.tell("lint default exports with Quality's Biome preset");
			const report = yield* biomeReport(engine.root, ["lint"]);
			engine.defaultExports = report.diagnostics
				.filter((diagnostic) => diagnostic.category === "lint/style/noDefaultExport")
				.flatMap((diagnostic) => diagnostic.location.path ?? [])
				.toSorted();
		}),
		violations: () => engine.violations.map(({ file, rule }) => ({ file, rule })),
	}),
});

export function namingFiles(files: readonly SeedFile[]) {
	return migrationFiles.trait("authored", "a repository contains migrations and authored neighbours", (engine) => {
		engine.root = seedTree([{ content: '{"type":"module"}', path: "package.json" }], files);
	});
}

export function presetFiles(files: readonly SeedFile[]) {
	return migrationFiles.trait("authored", "a repository extending Quality's Biome preset contains migrations and authored neighbours", (engine) => {
		engine.root = seedTree(
			[
				{ content: '{"type":"module"}', path: "package.json" },
				{ content: "node_modules/\n", path: ".gitignore" },
				{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
			],
			files,
		);
		linkPackage(engine.root);
	});
}
