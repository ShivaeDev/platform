import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_EXIT, quality, runQuality } from "#test/cli.ts";
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
	extends: ["@shivaedev/quality/biome/preset.json"],
	overrides: [{ includes: [parser.path], linter: { rules: { suspicious: { noExplicitAny: "off" } } } }],
};

describe("quality exceptions", { timeout: 60_000 }, () => {
	it("applies one declaration to Biome and Quality, at lint and fix time, without editing biome.json", async () => {
		const root = qualityTree([config(`{ exceptions: ${JSON.stringify([declaration])}, sources: ["src"] }`), parser]);
		const biome = readFileSync(join(root, "biome.json"), "utf8");
		const result = await runQuality(root, "lint");
		expect(result).toMatchObject({ status: 0, stdout: expect.stringContaining("1 registered violation not shown") });
		expect(await runQuality(root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, "biome.json"), "utf8")).toBe(biome);
		expect(readFileSync(join(root, parser.path), "utf8")).toContain(": any");
		expect(readdirSync(root).some((file) => file.startsWith(".quality-biome-"))).toBe(false);
	});

	it("rejects a declaration without a reason before running rules", async () => {
		const root = qualityTree([config(`{ exceptions: [{ files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] }], sources: ["src"] }`), parser]);
		expect(await runQuality(root, "lint")).toMatchObject({ status: 2, stderr: expect.stringContaining("exceptions.0.reason") });
	});

	it("keeps undeclared biome.json overrides visible even with a matching single-store exception", async () => {
		const root = qualityTree([
			config(`{ exceptions: ${JSON.stringify([declaration])}, sources: ["src"] }`),
			parser,
			{ content: JSON.stringify(overrides), path: "biome.json" },
		]);
		expect(await runQuality(root, "lint")).toMatchObject({ status: 1, stdout: expect.stringContaining('Weakens "lint/suspicious/noExplicitAny"') });
	});

	it("shows the selected config and declaration shape for both kinds of finding", async () => {
		const root = qualityTree([{ content: 'export default { sources: ["src"] };\n', path: "custom.config.ts" }, parser]);
		const result = await runQuality(root, "lint", "--config", "custom.config.ts");
		expect(result.status).toBe(CLI_EXIT.rejected);
		for (const rule of declaration.rules) {
			expect(result.stdout).toContain(
				`add to exceptions in custom.config.ts: ${JSON.stringify({ files: [parser.path], reason: "Explain why this exception is permanent.", rules: [rule] })}`,
			);
		}
	});

	it("moves a legacy registry and Biome declaration into one entry, and deletes duplicated overrides", async () => {
		const declared = { declared: [{ includes: [parser.path], reason: REASON, rule: "lint/suspicious/noExplicitAny" }] };
		const root = qualityTree([
			config(`{ rules: { "suppressions/biome-overrides": { options: ${JSON.stringify(declared)} } }, sources: ["src"] }`),
			parser,
			{ content: JSON.stringify(overrides), path: "biome.json" },
			{ content: JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc" }]), path: "quality/registry.json" },
		]);
		expect(await runQuality(root, "exceptions", "migrate")).toMatchObject({ status: 0 });
		expect(existsSync(join(root, "quality/registry.json"))).toBe(false);
		const migrated = readFileSync(join(root, "quality.config.ts"), "utf8");
		expect(migrated).toContain("exceptions:");
		expect(migrated).toContain('sources: ["src"]');
		expect(migrated).not.toContain("suppressions/biome-overrides");
		expect(migrated.match(/This parser documents/gu)).toEqual(["This parser documents"]);
		expect(readFileSync(join(root, "biome.json"), "utf8")).not.toContain("overrides");
		// The rewritten config is a new module under the same path, which only a fresh process imports.
		expect(quality(root, "fix")).toMatchObject({ status: 0 });
		expect(quality(root, "lint")).toMatchObject({ status: 0 });
	});

	it("reports a Biome exception for a missing file", async () => {
		const root = qualityTree([
			config(
				`{ exceptions: ${JSON.stringify([{ ...declaration, files: ["src/missing.ts"], rules: ["biome/lint/suspicious/noExplicitAny"] }])}, sources: ["src"] }`,
			),
			parser,
		]);
		expect(await runQuality(root, "lint")).toMatchObject({ status: 1, stdout: expect.stringContaining("This Biome exception names a missing file") });
	});

	it("creates a config from a legacy registry selected with --from", async () => {
		const root = qualityTree([
			parser,
			{
				content: JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc", subject: "external-format" }]),
				path: "old-exceptions.json",
			},
		]);
		expect(await runQuality(root, "exceptions", "migrate", "--from", "old-exceptions.json")).toMatchObject({ status: 0 });
		expect(existsSync(join(root, "old-exceptions.json"))).toBe(false);
		expect(readFileSync(join(root, "quality.config.ts"), "utf8")).toContain('"subject": "external-format"');
	});

	it("leaves the registry and config intact when automatic migration cannot edit the config", async () => {
		const body = 'const policy = { sources: ["src"] }; export default policy;';
		const registry = JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc" }]);
		const root = qualityTree([{ content: body, path: "custom.config.ts" }, parser, { content: registry, path: "quality/registry.json" }]);
		const before = readFileSync(join(root, "custom.config.ts"), "utf8");
		expect(await runQuality(root, "exceptions", "migrate", "--config", "custom.config.ts")).toMatchObject({
			status: 2,
			stderr: expect.stringContaining("Cannot migrate"),
		});
		expect(readFileSync(join(root, "custom.config.ts"), "utf8")).toBe(before);
		expect(Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(readFileSync(join(root, "quality/registry.json"), "utf8"))).toEqual(
			Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(registry),
		);
	});

	it("retains legacy registry compatibility and reports stale config exceptions", async () => {
		const root = qualityTree([
			config('{ sources: ["src"] }'),
			parser,
			{ content: JSON.stringify([{ file: parser.path, reason: REASON, rule: "comments/no-jsdoc" }]), path: "quality/registry.json" },
		]);
		expect((await runQuality(root, "lint")).stdout).not.toContain("src/parse.ts:1");
		const stale = qualityTree([
			config(`{ exceptions: ${JSON.stringify([{ ...declaration, files: ["src/missing.ts"], rules: ["comments/no-jsdoc"] }])}, sources: ["src"] }`),
			parser,
		]);
		expect(await runQuality(stale, "lint")).toMatchObject({
			status: 1,
			stdout: expect.stringContaining("comments/no-jsdoc src/missing.ts matches no violation"),
		});
	});
});
