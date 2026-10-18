import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodeConfig } from "#config/decode.ts";
import { resolveRules } from "#config/resolve.ts";
import { defineConfig } from "#config.ts";
import { defineRule } from "#rule.ts";
import { builtInRules } from "#rules/builtIn.ts";

const todo = defineRule({ check: () => [], description: "Resolve TODOs.", id: "local/no-todo" });

async function resolve(config: unknown) {
	const decoded = await decodeConfig(config);
	return decoded._tag === "Invalid" ? decoded : Effect.runPromise(resolveRules(decoded.value));
}

async function issues(config: unknown): Promise<readonly string[]> {
	const resolved = await resolve(config);
	return resolved._tag === "Invalid" ? resolved.issues : [];
}

describe("config", () => {
	it("defaults every rule to error", async () => {
		const resolved = await resolve(defineConfig({ local: [todo] }));
		expect(resolved._tag === "Valid" && [...resolved.value.levels]).toEqual([
			...builtInRules.map((rule) => [rule.id, "error"]),
			["local/no-todo", "error"],
		]);
	});

	it("keeps explicitly configured built-in and local rules at error", async () => {
		const resolved = await resolve(
			defineConfig({ local: [todo], rules: { "local/no-todo": "error", "structure/max-lines": { level: "error", options: { source: 100 } } } }),
		);
		expect(resolved._tag === "Valid" && resolved.value.active.map((rule) => [rule.id, rule.level])).toEqual(
			[...builtInRules, todo].map((rule) => [rule.id, "error"]),
		);
	});

	it.each(["warn", "off"])("rejects %s for built-in and local rules in both setting forms", async (level) => {
		for (const id of ["structure/max-lines", "local/no-todo"]) {
			for (const setting of [level, { level, options: { source: "many" } }]) {
				expect(await issues({ local: [todo], rules: { [id]: setting } })).toEqual([expect.stringContaining(id)]);
			}
		}
	});

	it.each([
		{ exclude: ["src/legacy/**"] },
		{ rules: { "structure/max-lines": { options: { source: 151 } } } },
		{ rules: { "structure/max-lines": { options: { test: 301 } } } },
		{ rules: { "structure/max-lines": { options: { testFiles: ["src/**"] } } } },
		{ rules: { "comments/max-per-file": { options: { max: 3 } } } },
	])("rejects policy weakening: %j", async (input) => {
		expect(await issues(input)).not.toEqual([]);
	});

	it("rejects an unknown setting", async () => {
		expect(await issues({ source: ["src"] })).toEqual([expect.stringContaining("source")]);
	});

	it("rejects the removed preCommit config with script guidance", async () => {
		expect(await issues({ preCommit: { run: ["pnpm typecheck"], tighten: true } })).toEqual([expect.stringContaining("quality:commit")]);
	});

	it("rejects an unknown rule id", async () => {
		expect(await issues({ rules: { "structure/max-line": "error" } })).toEqual(["rules.structure/max-line: no built-in or local rule has this id"]);
	});

	it("rejects an unknown level", async () => {
		expect(await issues({ rules: { "structure/max-lines": "warning" } })).not.toEqual([]);
	});

	it("names the rule whose options are invalid", async () => {
		expect(await issues({ rules: { "structure/max-lines": { options: { source: "many" } } } })).toEqual([
			expect.stringMatching(/^rules\.structure\/max-lines\.options: source: /u),
		]);
	});

	it("rejects a local rule that was not made with defineRule", async () => {
		expect(await issues({ local: [{ check: () => [], id: "local/x" }] })).toEqual([expect.stringContaining("defineRule")]);
	});

	it("rejects a local rule that reuses an id", async () => {
		const copy = defineRule({ check: () => [], description: "Shadows the built-in rule.", id: "structure/max-lines" });
		expect(await issues({ local: [todo, todo, copy] })).toEqual([
			'local: rule id "local/no-todo" is already defined',
			'local: rule id "structure/max-lines" is already defined',
		]);
	});

	it("reports an options schema that throws instead of crashing", async () => {
		const throwing = defineRule({
			check: () => [],
			description: "Its schema throws.",
			id: "local/throwing",
			options: {
				"~standard": {
					validate: () => {
						throw new Error("schema exploded");
					},
					vendor: "test",
					version: 1,
				},
			},
		});
		expect(await issues({ local: [throwing] })).toEqual(["rules.local/throwing.options: validation threw: schema exploded"]);
	});
});
