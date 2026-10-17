import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { qualityTree } from "#test/qualityTree.ts";
import { config, removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

const REASON = "This parser documents and returns the external format unchanged.";
const parser = {
	content: "/** External format. */\nexport function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n",
	path: "src/parse.ts",
};
const declaration = { files: [parser.path], reason: REASON, rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"] };
const overrides = {
	extends: ["@shivaedev/quality/biome"],
	overrides: [{ includes: [parser.path], linter: { rules: { suspicious: { noExplicitAny: "off" } } } }],
};

describe("quality exceptions", { timeout: 60_000 }, () => {
	it("applies one declaration to Biome and Quality, at lint and fix time, without editing biome.json", () => {
		const root = qualityTree([config(`{ exceptions: ${JSON.stringify([declaration])}, sources: ["src"] }`), parser]);
		const biome = readFileSync(join(root, "biome.json"), "utf8");
		const result = quality(root, "lint");
		expect(result).toMatchObject({ status: 0, stdout: expect.stringContaining("1 registered violation not shown") });
		expect(quality(root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, "biome.json"), "utf8")).toBe(biome);
		expect(readFileSync(join(root, parser.path), "utf8")).toContain(": any");
		expect(readdirSync(root).some((file) => file.startsWith(".quality-biome-"))).toBe(false);
	});

	it("rejects a declaration without a reason before running rules", () => {
		const root = qualityTree([config(`{ exceptions: [{ files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] }], sources: ["src"] }`), parser]);
		expect(quality(root, "lint")).toMatchObject({ status: 2, stderr: expect.stringContaining("exceptions.0.reason") });
	});

	it("keeps undeclared biome.json overrides visible even with a matching single-store exception", () => {
		const root = qualityTree([
			config(`{ exceptions: ${JSON.stringify([declaration])}, sources: ["src"] }`),
			parser,
			{ content: JSON.stringify(overrides), path: "biome.json" },
		]);
		expect(quality(root, "lint")).toMatchObject({ status: 1, stdout: expect.stringContaining('Weakens "lint/suspicious/noExplicitAny"') });
	});

	it("shows the selected config and declaration shape for both kinds of finding", () => {
		const root = qualityTree([{ content: 'export default { sources: ["src"] };\n', path: "custom.config.ts" }, parser]);
		const result = quality(root, "lint", "--config", "custom.config.ts");
		expect(result.status).toBe(1);
		for (const rule of declaration.rules) {
			expect(result.stdout).toContain(
				`add to exceptions in custom.config.ts: ${JSON.stringify({ files: [parser.path], reason: "Explain why this exception is permanent.", rules: [rule] })}`,
			);
		}
	});

	it("moves a legacy registry and Biome declaration into one entry, and deletes duplicated overrides", () => {
		const declared = { declared: [{ includes: [parser.path], reason: REASON, rule: "lint/suspicious/noExplicitAny" }] };
		const root = qualityTree([
			config(`{ rules: { "suppressions/biome-overrides": { options: ${JSON.stringify(declared)} } }, sources: ["src"] }`),
			parser,
			{ content: JSON.stringify(overrides), path: "biome.json" },
			{ content: JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc" }]), path: "quality/registry.json" },
		]);
		expect(quality(root, "exceptions", "migrate")).toMatchObject({ status: 0 });
		expect(existsSync(join(root, "quality/registry.json"))).toBe(false);
		const migrated = readFileSync(join(root, "quality.config.ts"), "utf8");
		expect(migrated).toContain("exceptions:");
		expect(migrated).toContain('sources: ["src"]');
		expect(migrated).not.toContain("suppressions/biome-overrides");
		expect(migrated.match(/This parser documents/gu)).toHaveLength(1);
		expect(readFileSync(join(root, "biome.json"), "utf8")).not.toContain("overrides");
		expect(quality(root, "fix")).toMatchObject({ status: 0 });
		expect(quality(root, "lint")).toMatchObject({ status: 0 });
	});

	it("reports a Biome exception for a missing file", () => {
		const root = qualityTree([
			config(
				`{ exceptions: ${JSON.stringify([{ ...declaration, files: ["src/missing.ts"], rules: ["biome/lint/suspicious/noExplicitAny"] }])}, sources: ["src"] }`,
			),
			parser,
		]);
		expect(quality(root, "lint")).toMatchObject({ status: 1, stdout: expect.stringContaining("This Biome exception names a missing file") });
	});

	it("creates a config from a legacy registry selected with --from", () => {
		const root = qualityTree([
			parser,
			{
				content: JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc", subject: "external-format" }]),
				path: "old-exceptions.json",
			},
		]);
		expect(quality(root, "exceptions", "migrate", "--from", "old-exceptions.json")).toMatchObject({ status: 0 });
		expect(existsSync(join(root, "old-exceptions.json"))).toBe(false);
		expect(readFileSync(join(root, "quality.config.ts"), "utf8")).toContain('"subject": "external-format"');
	});

	it("leaves the registry and config intact when automatic migration cannot edit the config", () => {
		const body = 'const policy = { sources: ["src"] }; export default policy;';
		const registry = JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc" }]);
		const root = qualityTree([{ content: body, path: "custom.config.ts" }, parser, { content: registry, path: "quality/registry.json" }]);
		const before = readFileSync(join(root, "custom.config.ts"), "utf8");
		expect(quality(root, "exceptions", "migrate", "--config", "custom.config.ts")).toMatchObject({
			status: 2,
			stderr: expect.stringContaining("Cannot migrate"),
		});
		expect(readFileSync(join(root, "custom.config.ts"), "utf8")).toBe(before);
		expect(JSON.parse(readFileSync(join(root, "quality/registry.json"), "utf8"))).toEqual(JSON.parse(registry));
	});

	it("retains legacy registry compatibility and reports stale config exceptions", () => {
		const root = qualityTree([
			config('{ sources: ["src"] }'),
			parser,
			{ content: JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc" }]), path: "quality/registry.json" },
		]);
		expect(quality(root, "lint").stdout).not.toContain("src/parse.ts:1");
		const stale = qualityTree([
			config(`{ exceptions: ${JSON.stringify([{ ...declaration, files: ["src/missing.ts"], rules: ["comments/no-jsdoc"] }])}, sources: ["src"] }`),
			parser,
		]);
		expect(quality(stale, "lint")).toMatchObject({
			status: 1,
			stdout: expect.stringContaining("comments/no-jsdoc src/missing.ts matches no violation"),
		});
	});
});
