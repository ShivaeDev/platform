import { NodeFileSystem } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { afterEach, expect } from "vitest";
import { collectInventory } from "../src/inventory/collect.ts";
import rawTree from "./fixtures/gitignore-tree.json" with { type: "json" };
import { removeSeededTrees, type SeedFile, seedTree } from "./support/tree.ts";

afterEach(removeSeededTrees);

const Seeded = Schema.Struct({ content: Schema.String, path: Schema.String });
const tree = Schema.decodeUnknownSync(
	Schema.Struct({ gitignores: Schema.Array(Seeded), ignoredPaths: Schema.Array(Schema.String), keptPaths: Schema.Array(Schema.String) }),
)(rawTree);

const sourceFiles = (paths: readonly string[]): readonly SeedFile[] => paths.map((path) => ({ content: "export const value = 1;\n", path }));
const ignored = sourceFiles(tree.ignoredPaths);
const kept = sourceFiles(tree.keptPaths);

const pathsOf = (root: string, sources: readonly string[] = ["."]) =>
	Effect.map(collectInventory(root, { exclude: [], extensions: [".ts"], sources }), (inventory) => inventory.sources.map((source) => source.path));

// Expected paths were captured from git check-ignore against the same fixture.
it.layer(NodeFileSystem.layer)("gitignore-aware discovery", (it) => {
	it.effect("keeps gitignored files out of the inventory", () =>
		Effect.gen(function* () {
			const paths = yield* pathsOf(seedTree(tree.gitignores, ignored, kept));
			for (const path of tree.ignoredPaths) {
				expect(paths).not.toContain(path);
			}
			for (const path of tree.keptPaths) {
				expect(paths).toContain(path);
			}
		}),
	);

	it.effect("walks the identical tree in full when nothing is ignored", () =>
		Effect.gen(function* () {
			const paths = yield* pathsOf(seedTree(ignored, kept));
			expect(paths).toEqual([...tree.ignoredPaths, ...tree.keptPaths].sort());
		}),
	);

	it.effect("applies the ignore files above a nested source directory", () =>
		Effect.gen(function* () {
			const paths = yield* pathsOf(seedTree(tree.gitignores, ignored, kept), ["packages/y", "packages/w"]);
			expect(paths).toEqual(["packages/y/generated/keep.ts"]);
		}),
	);

	it.effect("prunes vendored directories with no .gitignore present", () =>
		Effect.gen(function* () {
			const root = seedTree([
				{ content: "export const k = 1;\n", path: "packages/x/src/mod.ts" },
				{ content: "export const v = 1;\n", path: "packages/x/node_modules/v/index.ts" },
			]);
			expect(yield* pathsOf(root)).toEqual(["packages/x/src/mod.ts"]);
		}),
	);
});
