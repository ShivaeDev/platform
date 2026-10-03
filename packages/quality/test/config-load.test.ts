import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { afterEach, expect } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { config, removeSeededTrees, seedTree } from "./support/tree.ts";

afterEach(removeSeededTrees);

const failureOf = (cwd: string, path?: string) =>
	Effect.map(Effect.exit(loadConfig(cwd, path)), (exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "(it loaded)"));

it.layer(NodeFileSystem.layer)("config loading", (it) => {
	it.effect("loads quality.config.ts with the defaults filled in", () =>
		Effect.gen(function* () {
			const root = seedTree([config("{}")]);
			const loaded = yield* loadConfig(root, undefined);
			expect(loaded).toMatchObject({
				adopt: [],
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
				"comments/max-per-file",
				"suppressions/no-inline",
				"suppressions/no-double-cast",
				"suppressions/biome-overrides",
			]);
			expect([...loaded.unregistrable]).toEqual(["suppressions/no-inline", "suppressions/no-double-cast", "suppressions/biome-overrides"]);
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

	it.effect("refuses to adopt a rule that does not exist", () =>
		Effect.gen(function* () {
			const root = seedTree([config('{ adopt: ["comments/no-todos"], rules: { "structure/max-line": "error" } }')]);
			const text = yield* failureOf(root);
			expect(text).toContain("rules.structure/max-line: no built-in or local rule has this id");
			expect(text).toContain("adopt.comments/no-todos: no built-in or local rule has this id");
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
