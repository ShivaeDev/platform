import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { generatedAuthored } from "#test/generatedAuthored.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("authored code in generated folders", () => {
	it("checks tracked ignored files with source, naming, suppression and Biome rules", () => {
		const root = generatedAuthored();
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

	it("fixes authored tracked files in generated folders while leaving generated output alone", () => {
		const root = generatedAuthored();
		expect(quality(root, "fix").status).toBe(0);
		expect(readFileSync(join(root, "src/generated/WrongFolder/badName.ts"), "utf8")).not.toContain("debugger;");
		expect(readFileSync(join(root, "src/generated/output.ts"), "utf8")).toContain("debugger;");
	});
});
