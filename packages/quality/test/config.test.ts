import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodeConfig } from "../src/config/decode.ts";
import { resolveRules } from "../src/config/resolve.ts";
import { defineConfig, defineRule } from "../src/index.ts";
import { builtInRules } from "../src/rules/built-in.ts";

const todo = defineRule({ id: "local/no-todo", description: "Resolve TODOs.", check: () => [] });

const resolve = async (config: unknown) => {
	const decoded = await decodeConfig(config);
	return decoded._tag === "Invalid" ? decoded : Effect.runPromise(resolveRules(decoded.value));
};

const issues = async (config: unknown): Promise<ReadonlyArray<string>> => {
	const resolved = await resolve(config);
	return resolved._tag === "Invalid" ? resolved.issues : [];
};

describe("config", () => {
	it("defaults every rule to error", async () => {
		const resolved = await resolve(defineConfig({ local: [todo] }));
		expect(resolved._tag === "Valid" && [...resolved.value.levels]).toEqual([
			...builtInRules.map((rule) => [rule.id, "error"]),
			["local/no-todo", "error"],
		]);
	});

	it("applies levels given as a string or with options", async () => {
		const resolved = await resolve(
			defineConfig({ local: [todo], rules: { "local/no-todo": "off", "structure/max-lines": { level: "warn", options: { source: 200 } } } }),
		);
		const active = resolved._tag === "Valid" ? resolved.value.active.map((rule) => [rule.id, rule.level]) : [];
		expect(active).toContainEqual(["structure/max-lines", "warn"]);
		expect(active.map(([id]) => id)).not.toContain("local/no-todo");
	});

	it("does not validate the options of a rule that is off", async () => {
		expect(await issues({ rules: { "structure/max-lines": { level: "off", options: { source: "many" } } } })).toEqual([]);
	});

	it("rejects an unknown setting", async () => {
		expect(await issues({ source: ["src"] })).toEqual([expect.stringContaining("source")]);
	});

	it("rejects an unknown rule id", async () => {
		expect(await issues({ rules: { "structure/max-line": "error" } })).toEqual(["rules.structure/max-line: no built-in or local rule has this id"]);
	});

	it("rejects an unknown level", async () => {
		expect(await issues({ rules: { "structure/max-lines": "warning" } })).not.toEqual([]);
	});

	it("names the rule whose options are invalid", async () => {
		expect(await issues({ rules: { "structure/max-lines": { options: { source: "many" } } } })).toEqual([
			expect.stringMatching(/^rules\.structure\/max-lines\.options: source: /),
		]);
	});

	it("rejects a local rule that was not made with defineRule", async () => {
		expect(await issues({ local: [{ id: "local/x", check: () => [] }] })).toEqual([expect.stringContaining("defineRule")]);
	});

	it("rejects a local rule that reuses an id", async () => {
		const copy = defineRule({ id: "structure/max-lines", description: "Shadows the built-in rule.", check: () => [] });
		expect(await issues({ local: [todo, todo, copy] })).toEqual([
			'local: rule id "local/no-todo" is already defined',
			'local: rule id "structure/max-lines" is already defined',
		]);
	});

	it("reports an options schema that throws instead of crashing", async () => {
		const throwing = defineRule({
			id: "local/throwing",
			description: "Its schema throws.",
			options: {
				"~standard": {
					vendor: "test",
					version: 1,
					validate: () => {
						throw new Error("schema exploded");
					},
				},
			},
			check: () => [],
		});
		expect(await issues({ local: [throwing] })).toEqual(["rules.local/throwing.options: validation threw: schema exploded"]);
	});
});
