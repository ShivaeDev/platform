import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { quality, qualityWithin } from "#test/cli.ts";
import { styleRepository } from "#test/styleRepository.ts";
import { removeSeededTrees } from "#test/tree.ts";
import { runBiome } from "./run.ts";

const TIMEOUT = 60_000;
const ARRAYS = "export const values: Array<string> = [];\nexport const frozen: ReadonlyArray<number> = [];\n";
const JSX = 'export const text = <p title={"a\\nb"}>{"line one\\nline two"}</p>;\n';
const SHADOWED = [
	"interface Array<T> { readonly value: T; }",
	"interface ReadonlyArray<T> { readonly item: T; }",
	'export const value: Array<string> = { value: "one" };',
	'export const frozen: ReadonlyArray<string> = { item: "two" };',
	"",
].join("\n");

afterEach(removeSeededTrees);

function typeErrors(path: string): readonly ts.Diagnostic[] {
	const program = ts.createProgram([path], { noEmit: true, skipLibCheck: true, strict: true });
	return program.getSemanticDiagnostics().filter((diagnostic) => diagnostic.file?.fileName === path);
}

describe("array and JSX style fixes", { timeout: TIMEOUT }, () => {
	it("keeps reporting both styles as errors without changing types or JSX strings during repeated unsafe fixes", async () => {
		const root = styleRepository({ arrays: ARRAYS, jsx: JSX });
		for (let round = 0; round < 2; round += 1) {
			expect(await qualityWithin(TIMEOUT / 2, root, "fix")).toMatchObject({ status: 0 });
			expect(readFileSync(join(root, "src/arrays.ts"), "utf8")).toBe(ARRAYS);
			expect(readFileSync(join(root, "src/text.tsx"), "utf8")).toBe(JSX);
			const result = quality(root, "lint");
			expect(result.status).toBe(1);
			expect(result.stdout).toContain("error biome/lint/style/useConsistentArrayType (2)");
			expect(result.stdout).toContain("error biome/lint/style/useConsistentCurlyBraces (2)");
		}
	});

	it("accepts manually repaired array shorthand and literal JSX text", () => {
		const root = styleRepository({
			arrays: ARRAYS.replace("Array<string>", "string[]").replace("ReadonlyArray<number>", "readonly number[]"),
			jsx: 'export const text = <p title="plain">line one</p>;\n',
		});
		expect(quality(root, "lint")).toMatchObject({ status: 0 });
	});

	it("reproduces the type and escaped-text changes when the native unsafe fixes are forced on", async () => {
		const root = styleRepository({ arrays: SHADOWED, jsx: JSX, nativeFixes: true });
		const path = join(root, "src/arrays.ts");
		expect(typeErrors(path)).toEqual([]);
		expect(
			await runBiome(root, ["lint", "--write", "--unsafe", "--only=lint/style/useConsistentArrayType", "--only=lint/style/useConsistentCurlyBraces"]),
		).toMatchObject({ code: 0 });
		expect(readFileSync(path, "utf8")).toContain('export const value: string[] = { value: "one" };');
		expect(readFileSync(path, "utf8")).toContain('export const frozen: readonly string[] = { item: "two" };');
		expect(typeErrors(path).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "))).toEqual([
			expect.stringContaining("Object literal may only specify known properties"),
			expect.stringContaining("Object literal may only specify known properties"),
		]);
		expect(readFileSync(join(root, "src/text.tsx"), "utf8")).toBe('export const text = <p title="a\\nb">line one\\nline two</p>;\n');
	});
});
