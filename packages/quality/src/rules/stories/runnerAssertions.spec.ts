import { afterEach, expect, it } from "vitest";
import { noExpect } from "#rules/stories/noExpect.ts";
import { findingsIn } from "#test/imports.ts";
import { kitFiles } from "#test/storySpecFiles.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

it.each([
	'runStories({ include: "src/test-support/failingStories.ts" });',
	'runStories(new URL("./test-support/failingStories.ts", import.meta.url));',
	'runStories({ include: ["src/test-support/*Stories.ts"] });',
])("lets an unimported story fixture assert when the outer spec names its path: %s", async (run) => {
	const root = seedTree([
		...kitFiles,
		{
			content: 'import { expect } from "vitest"; import { orders } from "#test/orders.ts"; orders.it("fails", [], () => { expect(1).toBe(2); });',
			path: "src/test-support/failingStories.ts",
		},
		{ content: run, path: "src/runner.spec.ts" },
	]);
	expect(await findingsIn(noExpect, undefined, root)).toEqual([]);
});

it.each([
	'it("passes", () => { expect(true).toBe(true); });',
	'test("fails", () => { expect(true).toBe(false); });',
	'describe("suite", () => { it("passes", () => { expect(true).toBe(true); }); });',
	'it.effect("passes", function* () { expect(true).toBe(true); });',
	'const effectDb = it.effectDB; effectDb("passes", function* () { expect(true).toBe(true); });',
	'const focused = kit.it.only; focused("passes", [], () => { expect(true).toBe(true); });',
	'import { it as plain } from "vitest"; plain("passes", () => { expect(true).toBe(true); });',
	'import * as v from "vitest"; v.test("passes", () => { expect(true).toBe(true); });',
	'import * as v from "vitest"; v.describe("suite", () => { v.test("passes", () => { expect(true).toBe(true); }); });',
])("recognizes module-level runner registration: %s", async (content) => {
	const root = seedTree([{ content, path: "src/test-support/runner.ts" }]);
	expect(await findingsIn(noExpect, undefined, root)).toEqual([]);
});

it("keeps expectations in an exported support verb visible", async () => {
	const root = seedTree([
		{ content: 'import { expect } from "vitest";\nexport function savesOrder() { expect(true).toBe(true); }', path: "src/test-support/orders.ts" },
	]);
	expect(await findingsIn(noExpect, undefined, root)).toEqual([
		{
			file: "src/test-support/orders.ts",
			line: 2,
			message:
				"Calls expect in test-support. Return the engine's observed state from the verb and put the expectation in the spec; throw if an action cannot run.",
		},
	]);
});

it.each([
	'import "./test-support/failingStories.ts";',
	'await import("./test-support/failingStories.ts");',
	'export * from "./test-support/failingStories.ts";',
])("reports a registered fixture consumed as a module: %s", async (content) => {
	const root = seedTree([
		{ content, path: "src/runner.spec.ts" },
		{
			content: 'import { expect, it } from "vitest";\nit("fails", () => { expect(true).toBe(false); });',
			path: "src/test-support/failingStories.ts",
		},
	]);
	expect(await findingsIn(noExpect, undefined, root)).toEqual([
		expect.objectContaining({
			file: "src/test-support/failingStories.ts",
			line: 2,
			message: expect.stringContaining("Calls expect in test-support."),
		}),
	]);
});

it("does not treat registration inside an exported helper as module-level tests", async () => {
	const root = seedTree([
		{
			content: 'export function orders() { it("fails", () => { expect(true).toBe(false); }); }',
			path: "src/test-support/orders.ts",
		},
	]);
	expect(await findingsIn(noExpect, undefined, root)).toEqual([
		expect.objectContaining({ file: "src/test-support/orders.ts", message: expect.stringContaining("Calls expect in test-support.") }),
	]);
});
