import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { qualityTree } from "#test/qualityTree.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

const FILE = "src/parse.ts";
const REASON = "This parser preserves the external format.";
const existing = { files: [FILE], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] };
const legacy = { options: { declared: [{ includes: [FILE], reason: REASON, rule: "lint/suspicious/noExplicitAny" }] } };
const registry = { content: JSON.stringify([{ file: FILE, reason: REASON, rule: "comments/no-jsdoc" }]), path: "custom-registry.json" };
const biome = {
	content: JSON.stringify({ overrides: [{ includes: [FILE], linter: { rules: { suspicious: { noExplicitAny: "off" } } } }] }),
	path: "biome.json",
};

it.each(['"', "`"])("migrates computed literal keys using %s without losing exceptions or retaining legacy declarations", (quote) => {
	function key(name: string): string {
		return `[${quote}${name}${quote}]`;
	}
	const root = qualityTree([
		{
			content: `export default {
				sources: ["src"],
				${key("exceptions")}: ${JSON.stringify([existing])},
				${key("registry")}: "custom-registry.json",
				${key("rules")}: { ${key("suppressions/biome-overrides")}: ${JSON.stringify(legacy)}, "comments/no-jsdoc": {} }
			};`,
			path: "quality.config.ts",
		},
		registry,
		biome,
	]);
	expect(quality(root, "exceptions", "migrate")).toMatchObject({ status: 0 });
	expect(existsSync(join(root, registry.path))).toBe(false);
	const migrated = readFileSync(join(root, "quality.config.ts"), "utf8");
	expect(migrated).not.toContain("suppressions/biome-overrides");
	expect(migrated).not.toContain("custom-registry.json");
	expect(migrated).toContain('"comments/no-jsdoc": {}');
	expect(migrated.match(/This parser preserves/gu)).toEqual(["This parser preserves"]);
	expect(migrated).toContain('"biome/lint/suspicious/noExplicitAny"');
	expect(migrated).toContain('"comments/no-jsdoc"');
	expect(readFileSync(join(root, "biome.json"), "utf8")).not.toContain("overrides");
	expect(quality(root, "exceptions", "migrate")).toMatchObject({ status: 0 });
	expect(readFileSync(join(root, "quality.config.ts"), "utf8")).toBe(migrated);
});

it.each([
	`[key]: ${JSON.stringify([existing])}, rules: { "suppressions/biome-overrides": ${JSON.stringify(legacy)} }`,
	`exceptions: [], rules: { [rule]: ${JSON.stringify(legacy)} }`,
])("rejects dynamic computed keys before changing any migration inputs: %s", (properties) => {
	const inputs = [
		{
			content: `const key = "exceptions"; const rule = "suppressions/biome-overrides";
				export default { ${properties}, registry: "custom-registry.json", sources: ["src"] };`,
			path: "quality.config.ts",
		},
		registry,
		biome,
	];
	const root = qualityTree(inputs);
	const before = inputs.map(({ path }) => ({ content: readFileSync(join(root, path), "utf8"), path }));
	expect(quality(root, "exceptions", "migrate")).toMatchObject({ status: 2, stderr: expect.stringContaining("computed property") });
	for (const input of before) {
		expect(readFileSync(join(root, input.path), "utf8")).toBe(input.content);
	}
});
