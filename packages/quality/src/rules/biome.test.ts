import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parserWarning, uncoveredParser } from "#test/biomeExceptions.ts";
import { runQuality } from "#test/cli.ts";
import { git } from "#test/git.ts";
import { config, linkPackage, removeSeededTrees, type SeedFile, seedTree } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;

afterEach(removeSeededTrees);

function biome(content: string): SeedFile {
	return { content: `${content}\n`, path: "biome.json" };
}

const preset = biome('{ "extends": ["@shivaedev/quality/biome/preset.json"] }');

const looseType: SeedFile = { content: "export function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n", path: "src/parse.ts" };

function repository(...files: readonly SeedFile[]): string {
	const root = seedTree([config('{ sources: ["src"] }'), { content: "node_modules/\n", path: ".gitignore" }, ...files]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

describe("the biome rule", { timeout: CLI_TIMEOUT }, () => {
	it("reports each Biome finding under the shared preset as biome/<category>, at its line", async () => {
		const root = repository(preset, looseType, { content: "export const b = 1\n", path: "src/b.ts" });
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error biome/lint/suspicious/noExplicitAny (1)\n  src/parse.ts:1  Unexpected any. Specify a different type.");
		expect(result.stdout).toContain("error biome/format (1)\n  src/b.ts  Is not formatted. Run `quality fix`.");
	});

	it("takes Biome findings into the baseline per rule and file, and fails when one grows", async () => {
		const root = repository(preset, looseType);
		expect(await runQuality(root, "baseline", "write")).toMatchObject({
			status: 0,
			stdout: "quality: recorded 1 entry in quality/baseline.jsonl.\n",
		});
		expect(readFileSync(join(root, "quality/baseline.jsonl"), "utf8")).toBe(
			'{"path":"src/parse.ts","rule":"biome/lint/suspicious/noExplicitAny","count":1}\n',
		);
		expect((await runQuality(root, "lint")).status).toBe(0);
		writeFileSync(join(root, looseType.path), `${looseType.content}\nexport function revive(text: string): any {\n\treturn JSON.parse(text);\n}\n`);
		const grown = await runQuality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/parse.ts is over its baseline: 2 against 1 baselined.");
	});

	it("records every Biome rule again through the biome name", async () => {
		const root = repository(preset, looseType);
		expect((await runQuality(root, "baseline", "write", "--rule", "biome")).status).toBe(0);
		expect(readFileSync(join(root, "quality/baseline.jsonl"), "utf8")).toContain('"rule":"biome/lint/suspicious/noExplicitAny"');
		expect((await runQuality(root, "lint")).status).toBe(0);
	});

	it("asks for a root Biome config that extends the shared preset", async () => {
		const root = repository(biome('{ "extends": [] }'), looseType);
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			'error biome/preset (1)\n  biome.json  Extend "@shivaedev/quality/biome/preset.json" from the root Biome config.',
		);
	});

	it("honours a reasoned warning exception only for its declared file", async () => {
		const root = repository(
			biome(
				'{ "extends": ["@shivaedev/quality/biome/preset.json"], "overrides": [{ "includes": ["src/parse.ts"], "linter": { "rules": { "suspicious": { "noExplicitAny": "warn" } } } }] }',
			),
			looseType,
		);
		expect(await runQuality(parserWarning(root), "lint")).toMatchObject({ status: 0, stdout: "quality: passed. 1 source file checked.\n" });
		const uncovered = await runQuality(uncoveredParser(root), "lint");
		expect(uncovered.status).toBe(1);
		expect(uncovered.stdout).toContain("src/other.ts:1  Unexpected any. Specify a different type.");
		expect(uncovered.stdout).not.toContain("src/parse.ts:1  Unexpected any.");
	});

	it("exits 2 with Biome's message when Biome cannot read its config", async () => {
		const result = await runQuality(
			repository(biome('{ "extends": ["@shivaedev/quality/biome/preset.json"], "linter": { "unknownKey": true } }'), looseType),
			"lint",
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("rule biome failed: biome check");
		expect(result.stderr).toContain("Found an unknown key `unknownKey`.");
	});
});

describe("quality fix", { timeout: CLI_TIMEOUT }, () => {
	it("formats files but leaves key order and duplicate keys for a person to decide on, and the lint still reports them", async () => {
		const root = repository(preset, { content: "export const b = { z: 1, a: 2 }\nexport const twice = { a: 1, a: 2 }\n", path: "src/b.ts" });
		expect(await runQuality(root, "fix")).toMatchObject({
			status: 0,
			stdout: [
				"quality: sort-package-json rewrote 0 manifests.",
				"quality: Biome round 1 rewrote 1 file with fixes and 0 files with the format pass.",
				"quality: Biome round 2 rewrote 0 files with fixes and 0 files with the format pass.",
				"",
			].join("\n"),
		});
		expect(readFileSync(join(root, "src/b.ts"), "utf8")).toBe("export const b = { z: 1, a: 2 };\nexport const twice = { a: 1, a: 2 };\n");
		const { stdout } = await runQuality(root, "lint");
		expect(stdout).toContain("error biome/assist/source/useSortedKeys (1)\n  src/b.ts:1  The object properties are not sorted by key.");
		expect(stdout).toContain("biome/lint/suspicious/noDuplicateObjectKeys");
	});

	it("applies unsafe fixes and repeats them until a round rewrites nothing, since one fix can make room for another", async () => {
		const twoRounds: SeedFile = {
			content: 'export function isA(text: string): boolean {\n\treturn text.indexOf("a") == 0;\n}\n',
			path: "src/is-a.ts",
		};
		const root = repository(preset, twoRounds);
		expect(await runQuality(root, "fix")).toMatchObject({
			status: 0,
			stdout: expect.stringContaining(
				[
					"quality: Biome round 1 rewrote 1 file with fixes and 0 files with the format pass.",
					"quality: Biome round 2 rewrote 1 file with fixes and 0 files with the format pass.",
					"quality: Biome round 3 rewrote 0 files with fixes and 0 files with the format pass.",
				].join("\n"),
			),
		});
		expect(readFileSync(join(root, twoRounds.path), "utf8")).toBe(
			'export function isA(text: string): boolean {\n\treturn text.startsWith("a");\n}\n',
		);
	});
});
