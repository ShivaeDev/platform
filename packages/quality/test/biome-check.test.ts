import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, qualityWithin } from "#test/support/cli.ts";
import { git } from "#test/support/git.ts";
import { config, linkPackage, removeSeededTrees, type SeedFile, seedTree } from "#test/support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

function biome(content: string): SeedFile {
	return { content: `${content}\n`, path: "biome.json" };
}

const preset = biome('{ "extends": ["@shivaedev/quality/biome"] }');

const looseType: SeedFile = { content: "export function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n", path: "src/parse.ts" };

function repository(...files: readonly SeedFile[]): string {
	const root = seedTree([config('{ sources: ["src"] }'), { content: "node_modules/\n", path: ".gitignore" }, ...files]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

describe("the biome rule", { timeout: cliTimeout }, () => {
	it("reports each Biome finding under the shared preset as biome/<category>, at its line", () => {
		const root = repository(preset, looseType, { content: "export const b = 1\n", path: "src/b.ts" });
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error biome/lint/suspicious/noExplicitAny (1)\n  src/parse.ts:1  Unexpected any. Specify a different type.");
		expect(result.stdout).toContain("error biome/format (1)\n  src/b.ts  Is not formatted. Run `quality fix`.");
	});

	it("takes Biome findings into the baseline per rule and file, and fails when one grows", () => {
		const root = repository(preset, looseType);
		expect(quality(root, "baseline", "write")).toMatchObject({ status: 0, stdout: "quality: recorded 1 entry in quality/baseline.jsonl.\n" });
		expect(readFileSync(join(root, "quality/baseline.jsonl"), "utf8")).toBe(
			'{"path":"src/parse.ts","rule":"biome/lint/suspicious/noExplicitAny","count":1}\n',
		);
		expect(quality(root, "lint").status).toBe(0);
		writeFileSync(join(root, looseType.path), `${looseType.content}\nexport function revive(text: string): any {\n\treturn JSON.parse(text);\n}\n`);
		const grown = quality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/parse.ts is over its baseline: 2 against 1 baselined.");
	});

	it("records every Biome rule again through the biome name", () => {
		const root = repository(preset, looseType);
		expect(quality(root, "baseline", "write", "--rule", "biome").status).toBe(0);
		expect(readFileSync(join(root, "quality/baseline.jsonl"), "utf8")).toContain('"rule":"biome/lint/suspicious/noExplicitAny"');
		expect(quality(root, "lint").status).toBe(0);
	});

	it("asks for a root Biome config that extends the shared preset", () => {
		const root = repository(biome('{ "extends": [] }'), looseType);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain('error biome/preset (1)\n  biome.json  Extend "@shivaedev/quality/biome" from the root Biome config.');
	});

	it("leaves out a rule the repository declares at warn", () => {
		const root = repository(
			biome('{ "extends": ["@shivaedev/quality/biome"], "linter": { "rules": { "suspicious": { "noExplicitAny": "warn" } } } }'),
			looseType,
		);
		const declared = '{ options: { declared: [{ includes: ["**"], reason: "Migrating.", rule: "lint/suspicious/noExplicitAny" }] } }';
		writeFileSync(
			join(root, "quality.config.ts"),
			`export default {\n\trules: {\n\t\t"suppressions/biome-overrides": ${declared},\n\t},\n\tsources: ["src"],\n};\n`,
		);
		expect(quality(root, "lint")).toMatchObject({ status: 0, stdout: "quality: passed. 1 source file checked.\n" });
	});

	it("exits 2 with Biome's message when Biome cannot read its config", () => {
		const result = quality(repository(biome('{ "extends": ["@shivaedev/quality/biome"], "linter": { "unknownKey": true } }'), looseType), "lint");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("rule biome failed: biome check");
		expect(result.stderr).toContain("Found an unknown key `unknownKey`.");
	});
});

describe("quality fix", { timeout: cliTimeout }, () => {
	it("formats files but leaves the key order for a person to decide on, and the lint still reports it", () => {
		const root = repository(preset, { content: "export const b = { z: 1, a: 2 }\n", path: "src/b.ts" });
		expect(quality(root, "fix")).toMatchObject({
			status: 0,
			stdout: [
				"quality: sort-package-json rewrote 0 manifests.",
				"quality: Biome round 1 rewrote 1 file with fixes and 0 files with the format pass.",
				"quality: Biome round 2 rewrote 0 files with fixes and 0 files with the format pass.",
				"",
			].join("\n"),
		});
		expect(readFileSync(join(root, "src/b.ts"), "utf8")).toBe("export const b = { z: 1, a: 2 };\n");
		expect(quality(root, "lint").stdout).toContain(
			"error biome/assist/source/useSortedKeys (1)\n  src/b.ts:1  The object properties are not sorted by key.",
		);
	});

	it("applies Biome's unsafe lint fixes", () => {
		const root = repository(preset, { content: "export function same(a: number, b: number): boolean {\n\treturn a == b;\n}\n", path: "src/same.ts" });
		expect(quality(root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, "src/same.ts"), "utf8")).toBe("export function same(a: number, b: number): boolean {\n\treturn a === b;\n}\n");
		expect(quality(root, "lint").status).toBe(0);
	});

	it("runs a format pass after the lint fixes, so a fix that reshapes code ends formatted", () => {
		const oneLineIf: SeedFile = {
			content: "export function first(items: readonly number[]): number {\n\tif (items.length) return items[0] ?? 0;\n\treturn 0;\n}\n",
			path: "src/first.ts",
		};
		const root = repository(preset, oneLineIf);
		expect(quality(root, "fix")).toMatchObject({
			status: 0,
			stdout: [
				"quality: sort-package-json rewrote 0 manifests.",
				"quality: Biome round 1 rewrote 1 file with fixes and 0 files with the format pass.",
				"quality: Biome round 2 rewrote 0 files with fixes and 0 files with the format pass.",
				"",
			].join("\n"),
		});
		expect(readFileSync(join(root, oneLineIf.path), "utf8")).toBe(
			"export function first(items: readonly number[]): number {\n\tif (items.length > 0) {\n\t\treturn items[0] ?? 0;\n\t}\n\treturn 0;\n}\n",
		);
		expect(quality(root, "lint").status).toBe(0);
	});

	it("repeats the fixes until a round rewrites nothing, since one fix can make room for another", () => {
		const twoRounds: SeedFile = {
			content: 'export function isA(text: string): boolean {\n\treturn text.indexOf("a") == 0;\n}\n',
			path: "src/is-a.ts",
		};
		const root = repository(preset, twoRounds);
		expect(quality(root, "fix")).toMatchObject({
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

	it("returns on code where Biome's noProcessGlobal fix never settles", async () => {
		const neverSettles: SeedFile = { content: "export const n = Number(globalThis.process.env.N);\n", path: "src/n.ts" };
		const root = repository(preset, neverSettles);
		expect(await qualityWithin(cliTimeout / 2, root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, neverSettles.path), "utf8")).toBe(neverSettles.content);
	});

	it("returns on a switch where the fixes of useExhaustiveSwitchCases and noUselessSwitchCase undo each other", async () => {
		const partialSwitch: SeedFile = {
			content:
				'type Shape = "circle" | "square";\n\nexport function area(shape: Shape): number {\n\tswitch (shape) {\n\t\tcase "circle":\n\t\t\treturn 1;\n\t\tdefault:\n\t\t\treturn 2;\n\t}\n}\n',
			path: "src/area.ts",
		};
		const root = repository(preset, partialSwitch);
		expect(await qualityWithin(cliTimeout / 2, root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, partialSwitch.path), "utf8")).toBe(partialSwitch.content);
	});

	it("leaves an unused private member for a person to decide on, and the lint still reports it", async () => {
		const unusedMember: SeedFile = {
			content: "export class Counter {\n\tprivate readonly stale = 0;\n\n\tcount(): number {\n\t\treturn 1;\n\t}\n}\n",
			path: "src/counter.ts",
		};
		const root = repository(preset, unusedMember);
		expect(await qualityWithin(cliTimeout / 2, root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, unusedMember.path), "utf8")).toBe(unusedMember.content);
		expect(quality(root, "lint").stdout).toContain("biome/lint/correctness/noUnusedPrivateClassMembers");
	});

	it("leaves the fixes that can change behavior or remove a decision to a person, and the lint still reports them", async () => {
		const decisions: SeedFile = {
			content: [
				"export const digits = /[0-9]+/;",
				"export function last(items: readonly number[]): number | undefined {",
				"\treturn items[items.length - 1];",
				"}",
				"export async function load(): Promise<void> {",
				"\tPromise.resolve(1);",
				"}",
				"export const twice = { a: 1, a: 2 };",
				"",
			].join("\n"),
			path: "src/decisions.ts",
		};
		const root = repository(preset, decisions);
		expect(await qualityWithin(cliTimeout / 2, root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, decisions.path), "utf8")).toBe(decisions.content);
		const { stdout } = quality(root, "lint");
		for (const rule of ["nursery/useUnicodeRegex", "style/useAtIndex", "nursery/noFloatingPromises", "suspicious/noDuplicateObjectKeys"]) {
			expect(stdout).toContain(`biome/lint/${rule}`);
		}
	});

	it("groups imports as builtins, packages, @shivaedev packages, aliases and same-folder paths", () => {
		const mixed: SeedFile = {
			content: [
				'import { local } from "./local.ts";',
				'import { format } from "#lib/format.ts";',
				'import { quality } from "@shivaedev/quality";',
				'import { Effect } from "effect";',
				'import { test } from "bun:test";',
				'import { scoped } from "@scope/thing";',
				'import { readFileSync } from "node:fs";',
				"export const all = [local, format, quality, Effect, test, scoped, readFileSync];",
				"",
			].join("\n"),
			path: "src/mixed.ts",
		};
		const root = repository(preset, mixed);
		quality(root, "fix");
		expect(readFileSync(join(root, mixed.path), "utf8")).toBe(
			[
				'import { test } from "bun:test";',
				'import { readFileSync } from "node:fs";',
				'import { scoped } from "@scope/thing";',
				'import { Effect } from "effect";',
				'import { quality } from "@shivaedev/quality";',
				'import { format } from "#lib/format.ts";',
				'import { local } from "./local.ts";',
				"export const all = [local, format, quality, Effect, test, scoped, readFileSync];",
				"",
			].join("\n"),
		);
	});
});
