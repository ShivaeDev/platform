import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality } from "./support/cli.ts";
import { commitAll, git } from "./support/git.ts";
import { config, linkPackage, removeSeededTrees, type SeedFile, seedTree } from "./support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

function biome(content: string): SeedFile {
	return { content: `${content}\n`, path: "biome.json" };
}

const preset = biome('{ "extends": ["@shivaedev/quality/biome"] }');

const nullCheck: SeedFile = { content: "export function isMissing(value: number | null): boolean {\n\treturn value == null;\n}\n", path: "src/a.ts" };

function repository(...files: ReadonlyArray<SeedFile>): string {
	const root = seedTree([config('{ sources: ["src"] }'), { content: "node_modules/\n", path: ".gitignore" }, ...files]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

describe("the biome rule", { timeout: cliTimeout }, () => {
	it("reports each Biome finding under the shared preset as biome/<category>, at its line", () => {
		const root = repository(preset, nullCheck, { content: "export const b = 1\n", path: "src/b.ts" });
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error biome/lint/suspicious/noEqualsToNull (1)\n  src/a.ts:2  null comparison with == is disallowed.");
		expect(result.stdout).toContain("error biome/format (1)\n  src/b.ts  Is not formatted. Run `quality fix`.");
	});

	it("takes Biome findings into the baseline per rule and file, and fails when one grows", () => {
		const root = repository(preset, nullCheck);
		expect(quality(root, "baseline", "write")).toMatchObject({ status: 0, stdout: "quality: recorded 1 entry in quality/baseline.jsonl.\n" });
		expect(readFileSync(join(root, "quality/baseline.jsonl"), "utf8")).toBe(
			'{"path":"src/a.ts","rule":"biome/lint/suspicious/noEqualsToNull","count":1}\n',
		);
		expect(quality(root, "lint").status).toBe(0);
		writeFileSync(
			join(root, nullCheck.path),
			`${nullCheck.content}\nexport function isAbsent(value: number | null): boolean {\n\treturn value == null;\n}\n`,
		);
		const grown = quality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/a.ts is over its baseline: 2 against 1 baselined.");
	});

	it("adopts every Biome rule through the biome name", () => {
		const root = repository(preset, nullCheck);
		commitAll(root, "Base");
		git(root, "switch", "--quiet", "--create", "work");
		quality(root, "baseline", "write");
		expect(quality(root, "baseline", "check", "--against", "main").stdout).toContain(
			"biome/lint/suspicious/noEqualsToNull is newly baselined in 1 file without being named under `adopt`",
		);
		writeFileSync(join(root, "quality.config.ts"), 'export default { adopt: ["biome"], sources: ["src"] };\n');
		expect(quality(root, "baseline", "check", "--against", "main").stdout).toContain("adopted biome/lint/suspicious/noEqualsToNull");
	});

	it("asks for a root Biome config that extends the shared preset", () => {
		const root = repository(biome('{ "extends": [] }'), nullCheck);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain('error biome/preset (1)\n  biome.json  Extend "@shivaedev/quality/biome" from the root Biome config.');
	});

	it("leaves out a rule the repository declares at warn", () => {
		const root = repository(
			biome('{ "extends": ["@shivaedev/quality/biome"], "linter": { "rules": { "suspicious": { "noEqualsToNull": "warn" } } } }'),
			nullCheck,
		);
		const declared = '{ options: { declared: [{ includes: ["**"], reason: "Migrating.", rule: "lint/suspicious/noEqualsToNull" }] } }';
		writeFileSync(
			join(root, "quality.config.ts"),
			`export default {\n\trules: {\n\t\t"suppressions/biome-overrides": ${declared},\n\t},\n\tsources: ["src"],\n};\n`,
		);
		expect(quality(root, "lint")).toMatchObject({ status: 0, stdout: "quality: passed. 1 source file checked.\n" });
	});

	it("exits 2 with Biome's message when Biome cannot read its config", () => {
		const result = quality(repository(biome('{ "extends": ["@shivaedev/quality/biome"], "linter": { "unknownKey": true } }'), nullCheck), "lint");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("rule biome failed: biome check");
		expect(result.stderr).toContain("Found an unknown key `unknownKey`.");
	});
});

describe("quality fix", { timeout: cliTimeout }, () => {
	it("formats files and sorts keys, so the formatting findings are gone", () => {
		const root = repository(preset, { content: "export const b = { z: 1, a: 2 }\n", path: "src/b.ts" });
		expect(quality(root, "fix")).toMatchObject({ status: 0, stdout: "quality: Biome rewrote 1 file.\n" });
		expect(readFileSync(join(root, "src/b.ts"), "utf8")).toBe("export const b = { a: 2, z: 1 };\n");
		expect(quality(root, "lint").status).toBe(0);
	});
});
