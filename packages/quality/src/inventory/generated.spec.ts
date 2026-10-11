import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { git } from "#test/git.ts";
import { config, linkPackage, removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("authored code in generated folders", () => {
	let root: string;
	beforeEach(() => {
		root = seedTree([
			config('{ sources: ["src"] }'),
			{ content: '{ "extends": ["@shivaedev/quality/biome"] }', path: "biome.json" },
			{ content: "src/generated/\n", path: ".gitignore" },
			{
				content: `import "./missing.ts";\n// @ts-ignore\ndebugger;\nexport const actual = 1;\n${"\n".repeat(150)}`,
				path: "src/generated/WrongFolder/badName.ts",
			},
			{ content: "{}", path: "src/generated/BadNotes.json" },
			{ content: 'import "./untracked-missing.ts";\ndebugger;', path: "src/generated/output.ts" },
		]);
		linkPackage(root);
		git(root, "init", "--quiet");
		git(root, "add", "--force", "src/generated/WrongFolder/badName.ts", "src/generated/BadNotes.json");
	});

	it("checks tracked ignored files with source, naming, suppression and Biome rules", () => {
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		for (const rule of [
			"structure/max-lines",
			"suppressions/no-inline",
			"imports/resolvable",
			"files/named-after-export",
			"files/folder-names",
			"files/other-names",
			"biome/lint/suspicious/noDebugger",
		]) {
			expect(result.stdout).toContain(rule);
		}
		expect(result.stdout).not.toContain("untracked-missing");
	});

	it("fixes tracked ignored files while preserving untracked generated output", () => {
		expect(quality(root, "fix").status).toBe(0);
		expect(readFileSync(join(root, "src/generated/WrongFolder/badName.ts"), "utf8")).not.toContain("debugger;");
		expect(readFileSync(join(root, "src/generated/output.ts"), "utf8")).toContain("debugger;");
	});
});
