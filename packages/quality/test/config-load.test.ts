import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { afterEach, expect } from "vitest";
import { loadConfig } from "#config/load.ts";
import { config, removeSeededTrees, seedTree } from "#test/support/tree.ts";

afterEach(removeSeededTrees);

const failureOf = (cwd: string, path?: string) =>
	Effect.map(Effect.exit(loadConfig(cwd, path)), (exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "(it loaded)"));

it.layer(NodeFileSystem.layer)("config loading", (it) => {
	it.effect("loads quality.config.ts with the defaults filled in", () =>
		Effect.gen(function* () {
			const root = seedTree([config("{}")]);
			const loaded = yield* loadConfig(root, undefined);
			expect(loaded).toMatchObject({
				baseline: "quality/baseline.jsonl",
				exclude: [],
				file: join(root, "quality.config.ts"),
				registry: "quality/registry.json",
				root,
				sources: ["."],
			});
			expect(loaded.active.map((rule) => rule.id)).toEqual([
				"structure/max-lines",
				"comments/no-jsdoc",
				"comments/no-line-reference",
				"comments/no-pr-reference",
				"comments/no-banner",
				"comments/no-todo",
				"comments/no-environment-pragma",
				"comments/max-per-file",
				"suppressions/no-inline",
				"suppressions/no-double-cast",
				"suppressions/no-ignore-deprecations",
				"suppressions/biome-overrides",
				"biome",
				"imports/cycles",
				"imports/fences",
				"imports/resolvable",
				"imports/aliased",
				"manifests/sorted",
				"files/named-after-export",
				"files/folder-names",
				"files/other-names",
				"tests/follow",
				"tests/colocated",
			]);
			expect([...loaded.unregistrable]).toEqual([
				"suppressions/no-inline",
				"suppressions/no-double-cast",
				"suppressions/no-ignore-deprecations",
				"suppressions/biome-overrides",
				"biome",
				"imports/cycles",
				"manifests/sorted",
			]);
			expect([...loaded.families]).toEqual(["biome"]);
		}),
	);

	it.effect("takes the repository root from an explicit config path", () =>
		Effect.gen(function* () {
			const root = seedTree([{ content: "export default {};\n", path: "tools/quality.config.ts" }]);
			expect((yield* loadConfig(root, "tools/quality.config.ts")).root).toBe(join(root, "tools"));
		}),
	);

	it.effect("fails when there is no config", () =>
		Effect.gen(function* () {
			expect(yield* failureOf(seedTree([]))).toContain("no config at");
		}),
	);

	it.effect("fails when the config has no default export", () =>
		Effect.gen(function* () {
			const root = seedTree([{ content: "export const config = {};\n", path: "quality.config.ts" }]);
			expect(yield* failureOf(root)).toContain("has no default export");
		}),
	);

	it.effect("fails when the config does not load", () =>
		Effect.gen(function* () {
			const root = seedTree([{ content: "export default {\n", path: "quality.config.ts" }]);
			expect(yield* failureOf(root)).toContain("cannot load");
		}),
	);

	it.effect("refuses a rule that does not exist", () =>
		Effect.gen(function* () {
			const root = seedTree([config('{ rules: { "structure/max-line": "error" } }')]);
			expect(yield* failureOf(root)).toContain("rules.structure/max-line: no built-in or local rule has this id");
		}),
	);

	it.effect("refuses adopt, which the config no longer takes, and names what replaced it", () =>
		Effect.gen(function* () {
			const root = seedTree([config('{ adopt: ["comments/no-todo"] }')]);
			expect(yield* failureOf(root)).toContain(
				"adopt: removed in quality 0.7.0. Delete the key, and record a rule's existing findings with `quality baseline write --rule <id>`.",
			);
		}),
	);

	it.effect("lists every problem in an invalid config", () =>
		Effect.gen(function* () {
			const root = seedTree([config('{ rules: { "structure/max-line": "error", "structure/max-lines": "loud" }, sourcez: [] }')]);
			const text = yield* failureOf(root);
			expect(text).toContain("is invalid");
			expect(text).toContain("sourcez");
			expect(text).toContain("structure/max-lines");
		}),
	);
});
