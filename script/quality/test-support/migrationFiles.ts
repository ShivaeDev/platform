import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { biomeReport } from "@shivaedev/quality/biome/report.ts";
import { loadConfig } from "@shivaedev/quality/config/load.ts";
import { runRules } from "@shivaedev/quality/engine/runRules.ts";
import type { Violation } from "@shivaedev/quality/engine/violation.ts";
import { collectInventory } from "@shivaedev/quality/inventory/collect.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { linkPackage, type SeedFile, seedTree } from "#quality-fixtures/tree.ts";

interface Repository {
	defaultExports: readonly string[];
	root: string;
	violations: readonly Violation[];
}

export const migrationFiles = storyKit({
	clock: "live",
	create: (): Repository => ({ defaultExports: [], root: seedTree([]), violations: [] }),
	layer: NodeFileSystem.layer,
	name: "tool-owned migration files",
	stages: ["authored"],
	verbs: (engine, story) => ({
		checkNames: Effect.fn("MigrationFiles.checkNames")(function* () {
			story.tell("check file and folder names with Quality's default config");
			const config = yield* loadConfig(engine.root, undefined);
			const inventory = yield* collectInventory(engine.root, config);
			engine.violations = yield* runRules(
				config.active.filter((rule) => rule.id.startsWith("files/")),
				{ ...inventory, readText: (path) => readFile(join(engine.root, path), "utf8"), root: engine.root },
			);
		}),
		defaultExports: () => engine.defaultExports,
		lintDefaultExports: Effect.fn("MigrationFiles.lintDefaultExports")(function* () {
			story.tell("lint default exports with Quality's Biome preset");
			const report = yield* Effect.promise(() => biomeReport(engine.root, ["lint"]));
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
