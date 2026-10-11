import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, qualityWithin } from "#test/cli.ts";
import { git } from "#test/git.ts";
import { config, linkPackage, removeSeededTrees, seedTree } from "#test/tree.ts";

const TIMEOUT = 60_000;
afterEach(removeSeededTrees);

function repository(content: string): string {
	const root = seedTree([
		config('{ sources: ["src"] }'),
		{ content: "node_modules/\n", path: ".gitignore" },
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
		{ content, path: "src/semantics.ts" },
	]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

const decisions = [
	"export async function ownsWork(): Promise<boolean> {",
	"\tconst work = Promise.resolve(false);",
	"\tif (work) {",
	"\t\treturn true;",
	"\t}",
	"\treturn false;",
	"}",
	"export function missing(value: string | null | undefined): boolean {",
	"\treturn value == null;",
	"}",
	"export function present(value: string | null | undefined): boolean {",
	"\treturn value != null;",
	"}",
	"",
].join("\n");

describe("semantic Biome fixes", { timeout: TIMEOUT }, () => {
	it("reports promise conditionals and both loose null comparisons without changing them during repeated unsafe fixes", async () => {
		const root = repository(decisions);
		for (let round = 0; round < 2; round += 1) {
			expect(await qualityWithin(TIMEOUT / 2, root, "fix")).toMatchObject({ status: 0 });
			expect(readFileSync(join(root, "src/semantics.ts"), "utf8")).toBe(decisions);
			const result = quality(root, "lint");
			expect(result.status).toBe(1);
			expect(result.stdout).toContain("error biome/lint/nursery/noMisusedPromises (1)");
			expect(result.stdout).toContain("error biome/lint/suspicious/noEqualsToNull (2)");
		}
	});

	it("returns on a partial switch without adding cases that noUselessSwitchCase removes, and still reports the missing case", async () => {
		const partialSwitch = [
			'type Shape = "circle" | "square";',
			"",
			"export function area(shape: Shape): number {",
			"\tswitch (shape) {",
			'\t\tcase "circle":',
			"\t\t\treturn 1;",
			"\t\tdefault:",
			"\t\t\treturn 2;",
			"\t}",
			"}",
			"",
		].join("\n");
		const root = repository(partialSwitch);
		for (let round = 0; round < 2; round += 1) {
			expect(await qualityWithin(TIMEOUT / 2, root, "fix")).toMatchObject({ status: 0 });
			expect(readFileSync(join(root, "src/semantics.ts"), "utf8")).toBe(partialSwitch);
			expect(quality(root, "lint")).toMatchObject({
				status: 1,
				stdout: expect.stringContaining("error biome/lint/nursery/useExhaustiveSwitchCases (1)"),
			});
		}
	});

	it("accepts awaited promises, explicit nullish checks and explicit cases with an intentional default fallback", () => {
		const repaired = decisions
			.replace("if (work)", "if (await work)")
			.replace("value == null", "value === null || value === undefined")
			.replace("value != null", "value !== null && value !== undefined");
		const explicitSwitch = [
			'type Shape = "circle" | "square";',
			"",
			"export function area(shape: Shape): number {",
			"\tswitch (shape) {",
			'\t\tcase "circle":',
			"\t\t\treturn 1;",
			'\t\tcase "square":',
			"\t\t\treturn 2;",
			"\t\tdefault:",
			"\t\t\treturn 2;",
			"\t}",
			"}",
			"",
		].join("\n");
		expect(quality(repository(`${repaired}\n${explicitSwitch}`), "lint")).toMatchObject({ status: 0 });
	});
});
