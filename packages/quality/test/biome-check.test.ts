import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, qualityWithin } from "./support/cli.ts";
import { commitAll, git } from "./support/git.ts";
import { config, linkPackage, removeSeededTrees, type SeedFile, seedTree } from "./support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

function biome(content: string): SeedFile {
	return { content: `${content}\n`, path: "biome.json" };
}

const preset = biome('{ "extends": ["@shivaedev/quality/biome"] }');

const looseType: SeedFile = { content: "export function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n", path: "src/a.ts" };

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
		expect(result.stdout).toContain("error biome/lint/suspicious/noExplicitAny (1)\n  src/a.ts:1  Unexpected any. Specify a different type.");
		expect(result.stdout).toContain("error biome/format (1)\n  src/b.ts  Is not formatted. Run `quality fix`.");
	});

	it("takes Biome findings into the baseline per rule and file, and fails when one grows", () => {
		const root = repository(preset, looseType);
		expect(quality(root, "baseline", "write")).toMatchObject({ status: 0, stdout: "quality: recorded 1 entry in quality/baseline.jsonl.\n" });
		expect(readFileSync(join(root, "quality/baseline.jsonl"), "utf8")).toBe(
			'{"path":"src/a.ts","rule":"biome/lint/suspicious/noExplicitAny","count":1}\n',
		);
		expect(quality(root, "lint").status).toBe(0);
		writeFileSync(join(root, looseType.path), `${looseType.content}\nexport function revive(text: string): any {\n\treturn JSON.parse(text);\n}\n`);
		const grown = quality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/a.ts is over its baseline: 2 against 1 baselined.");
	});

	it("adopts every Biome rule through the biome name", () => {
		const root = repository(preset, looseType);
		commitAll(root, "Base");
		git(root, "switch", "--quiet", "--create", "work");
		quality(root, "baseline", "write");
		expect(quality(root, "baseline", "check", "--against", "main").stdout).toContain(
			"biome/lint/suspicious/noExplicitAny is newly baselined in 1 file without being named under `adopt`",
		);
		writeFileSync(join(root, "quality.config.ts"), 'export default { adopt: ["biome"], sources: ["src"] };\n');
		expect(quality(root, "baseline", "check", "--against", "main").stdout).toContain("adopted biome/lint/suspicious/noExplicitAny");
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
	it("formats files and sorts keys, so the formatting findings are gone", () => {
		const root = repository(preset, { content: "export const b = { z: 1, a: 2 }\n", path: "src/b.ts" });
		expect(quality(root, "fix")).toMatchObject({
			status: 0,
			stdout: "quality: sort-package-json rewrote 0 manifests.\nquality: Biome rewrote 1 file.\nquality: Biome's format pass rewrote 0 files.\n",
		});
		expect(readFileSync(join(root, "src/b.ts"), "utf8")).toBe("export const b = { a: 2, z: 1 };\n");
		expect(quality(root, "lint").status).toBe(0);
	});

	it("applies Biome's unsafe lint fixes", () => {
		const root = repository(preset, { content: "export function same(a: number, b: number): boolean {\n\treturn a == b;\n}\n", path: "src/a.ts" });
		expect(quality(root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, "src/a.ts"), "utf8")).toBe("export function same(a: number, b: number): boolean {\n\treturn a === b;\n}\n");
		expect(quality(root, "lint").status).toBe(0);
	});

	it("runs a format pass after the lint fixes, so a fix that reshapes code ends formatted", () => {
		const oneLineIf: SeedFile = {
			content: "export function first(items: readonly number[]): number {\n\tif (items.length) return items[0] ?? 0;\n\treturn 0;\n}\n",
			path: "src/a.ts",
		};
		const root = repository(preset, oneLineIf);
		expect(quality(root, "fix")).toMatchObject({
			status: 0,
			stdout: "quality: sort-package-json rewrote 0 manifests.\nquality: Biome rewrote 1 file.\nquality: Biome's format pass rewrote 0 files.\n",
		});
		expect(readFileSync(join(root, oneLineIf.path), "utf8")).toBe(
			"export function first(items: readonly number[]): number {\n\tif (items.length > 0) {\n\t\treturn items[0] ?? 0;\n\t}\n\treturn 0;\n}\n",
		);
		expect(quality(root, "lint").status).toBe(0);
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
});
