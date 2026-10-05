import { describe, expect, it } from "vitest";
import { storySetup } from "#rules/stories/setup.ts";
import { checkRule } from "#test/inputs.ts";

const STORY_KIT =
	"Name the setup in domain words as traits of the repository's story kit in test-support/, so the test reads as a story: see https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.";

async function findingsIn(content: string, path = "src/cart/cart.test.ts"): Promise<readonly string[]> {
	const findings = await checkRule(storySetup, undefined, { sources: [{ content, path }] });
	return findings.map((finding) => `${finding.line} ${finding.subject}`);
}

describe("tests/story-setup flags setup helpers", () => {
	it.each([
		"function seedCart() {}",
		"export function makeClient() {}",
		"const buildOrder = () => ({});",
		"const setup = function () {};",
		"let makeLayer = (() => 1);",
		"const seed = async () => {};",
	])("on %s", async (declaration) => {
		expect(await findingsIn(`${declaration}\n`)).toHaveLength(1);
	});

	it("names the helper and points at the story kit", async () => {
		const findings = await checkRule(storySetup, undefined, {
			sources: [{ content: "import { it } from 'vitest';\n\nfunction setupPaidOrder(): void {}\n", path: "src/orders/checkout.spec.ts" }],
		});
		expect(findings).toEqual([
			{ file: "src/orders/checkout.spec.ts", line: 3, message: `Declares the setup helper "setupPaidOrder". ${STORY_KIT}`, subject: "setupPaidOrder" },
		]);
	});

	it.each([
		{ content: "const builder = () => 1;\nfunction settings() {}\nconst makers = () => 1;\n", name: "a name that only starts with a prefix" },
		{ content: "const makeup = 1;\nconst seedRows = [1, 2];\n", name: "a constant that holds no function" },
		{ content: "describe('cart', () => {\n\tconst makeCart = () => ({});\n});\n", name: "a helper inside a describe block" },
		{ content: "function cartOf() {\n\tfunction seedCart() {}\n\treturn seedCart;\n}\n", name: "a helper inside a function" },
	])("but not on $name", async ({ content }) => {
		expect(await findingsIn(content)).toEqual([]);
	});
});

describe("tests/story-setup flags fixture writes", () => {
	it("through named, renamed, namespace, default and promises imports, at each call", async () => {
		const content = [
			'import fs, { mkdtempSync, writeFileSync as write, promises as fsp } from "node:fs";',
			'import * as files from "fs/promises";',
			'const root = mkdtempSync("cart-");',
			'write("a.json", "{}");',
			"fs.mkdirSync(root, { recursive: true });",
			'await fsp.writeFile("b.json", "{}");',
			'await files.cp("a", "b");',
			'await fs.promises.appendFile("c.txt", "x");',
		].join("\n");
		expect(await findingsIn(content)).toEqual(["3 mkdtempSync", "4 writeFileSync", "5 mkdirSync", "6 writeFile", "7 cp", "8 appendFile"]);
	});

	it("but not on reads, on functions of other modules or on calls written in strings", async () => {
		const content = [
			'import { readFileSync, existsSync } from "node:fs";',
			'import { writeFileSync } from "./disk.ts";',
			'readFileSync("a.json");',
			'existsSync("a.json");',
			'writeFileSync("a.json");',
			'const text = "writeFileSync(path)";',
		].join("\n");
		expect(await findingsIn(content)).toEqual([]);
	});
});

describe("tests/story-setup reads only test files", () => {
	it("and leaves source and test-support files alone, a test named file under test-support included", async () => {
		const content = 'import { writeFileSync } from "node:fs";\nexport function makeTree() {\n\twriteFileSync("a", "");\n}\n';
		const sources = ["src/tree.ts", "src/test-support/tree.ts", "src/test-support/tree.test.ts", "src/tree.dom.test.tsx"].map((path) => ({
			content,
			path,
		}));
		const findings = await checkRule(storySetup, undefined, { sources });
		expect(findings.map((finding) => `${finding.file} ${finding.subject}`)).toEqual([
			"src/tree.dom.test.tsx makeTree",
			"src/tree.dom.test.tsx writeFileSync",
		]);
	});
});
