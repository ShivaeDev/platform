import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { biomeOverrideInput } from "#test/biomeOverrideInput.ts";
import { CLI_EXIT, quality } from "#test/cli.ts";
import { formatTree, qualityTree } from "#test/qualityTree.ts";
import { config, removeSeededTrees } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;

afterEach(removeSeededTrees);

const REASON = "Vitest reads the fixture's first parameter and needs an object pattern.";

const declared = JSON.stringify({
	declared: [{ includes: ["src/vitest.ts"], reason: REASON, rule: "lint/correctness/noEmptyPattern" }],
});

const source = {
	content: "declare const raw: string;\n// @ts-expect-error The types reject it.\nexport const a: number = raw as unknown as number;\n",
	path: "src/a.ts",
};

describe("quality lint with the suppression rules", { timeout: CLI_TIMEOUT }, () => {
	it("reports inline suppressions, double casts and undeclared Biome overrides by default", () => {
		const root = qualityTree([config('{ sources: ["src"] }'), biomeOverrideInput({ correctness: { noEmptyPattern: "off" } }), source]);
		const result = quality(root, "lint");
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain('  src/a.ts:2  Suppresses a check: "@ts-expect-error".');
		expect(result.stdout).toContain('  src/a.ts:3  Casts through "unknown" to reach a type the value does not have.');
		expect(result.stdout).toContain('  biome.json:3  Weakens "lint/correctness/noEmptyPattern" for "src/vitest.ts" without a declaration.');
	});

	it("accepts a declared override and fails when the Biome config drifts from it", () => {
		const root = qualityTree([
			config(`{ rules: { "suppressions/biome-overrides": { options: ${declared} } }, sources: ["src"] }`),
			biomeOverrideInput({ correctness: { noEmptyPattern: "off" } }),
			{ content: "export function a(): number {\n\treturn 1;\n}\n", path: "src/a.ts" },
		]);
		expect(quality(root, "lint").status).toBe(CLI_EXIT.passed);
		writeFileSync(join(root, "biome.json"), biomeOverrideInput({ suspicious: { noExplicitAny: "off" } }).content);
		const drifted = quality(formatTree(root), "lint");
		expect(drifted.status).toBe(CLI_EXIT.rejected);
		expect(drifted.stdout).toContain('Weakens "lint/suspicious/noExplicitAny" for "src/vitest.ts" without a declaration.');
		expect(drifted.stdout).toContain('Declares "lint/correctness/noEmptyPattern" for "src/vitest.ts", which no Biome config weakens.');
	});

	it("refuses registry entries for the suppression rules and adopts existing suppressions only through the baseline", () => {
		const registry = [{ file: "src/a.ts", reason: "Legacy code.", rule: "suppressions/no-inline" }];
		const root = qualityTree([config('{ sources: ["src"] }'), source, { content: JSON.stringify(registry), path: "quality/registry.json" }]);
		const refused = quality(root, "lint");
		expect(refused.status).toBe(CLI_EXIT.rejected);
		expect(refused.stdout).toContain('Suppresses a check: "@ts-expect-error".');
		expect(refused.stdout).toContain("suppressions/no-inline src/a.ts names a rule that takes no exceptions.");

		writeFileSync(join(root, "quality/registry.json"), "[]\n");
		expect(quality(formatTree(root), "baseline", "write")).toMatchObject({
			status: 0,
			stdout: "quality: recorded 3 entries in quality/baseline.jsonl.\n",
		});
		expect(quality(root, "lint")).toMatchObject({ status: 0, stdout: expect.stringContaining("4 baselined violations not shown") });

		writeFileSync(join(root, "src/a.ts"), `${source.content}// @ts-ignore\n`);
		const grown = quality(root, "lint");
		expect(grown.status).toBe(CLI_EXIT.rejected);
		expect(grown.stdout).toContain("src/a.ts is over its baseline: 2 against 1 baselined.");
	});
});
