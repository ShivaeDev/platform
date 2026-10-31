import { expect } from "vitest";
import { noExpect } from "#rules/stories/noExpect.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { kitFiles } from "#test/storySpecFiles.ts";

const FAILING_STORIES = {
	content: 'import { expect } from "vitest"; import { orders } from "#test/orders.ts"; orders.it("fails", [], () => { expect(1).toBe(2); });',
	path: "src/test-support/failingStories.ts",
};

const FAILING_TESTS = {
	content: 'import { expect, it } from "vitest";\nit("fails", () => { expect(true).toBe(false); });',
	path: "src/test-support/failingStories.ts",
};

for (const run of [
	'runStories({ include: "src/test-support/failingStories.ts" });',
	'runStories(new URL("./test-support/failingStories.ts", import.meta.url));',
	'runStories({ include: ["src/test-support/*Stories.ts"] });',
]) {
	ruleStory.it(
		`tests/no-expect-in-support lets a story fixture assert when a spec runs it by path with ${run}`,
		[repositoryHas(...kitFiles, FAILING_STORIES, { content: run, path: "src/runner.spec.ts" })],
		function* ({ check }) {
			expect(yield* check(noExpect)).toEqual([]);
		},
	);
}

for (const registration of [
	'it("passes", () => { expect(true).toBe(true); });',
	'test("fails", () => { expect(true).toBe(false); });',
	'describe("suite", () => { it("passes", () => { expect(true).toBe(true); }); });',
	'it.effect("passes", function* () { expect(true).toBe(true); });',
	'const effectDb = it.effectDB; effectDb("passes", function* () { expect(true).toBe(true); });',
	'const focused = kit.it.only; focused("passes", [], () => { expect(true).toBe(true); });',
	'import { it as plain } from "vitest"; plain("passes", () => { expect(true).toBe(true); });',
	'import * as v from "vitest"; v.test("passes", () => { expect(true).toBe(true); });',
	'import * as v from "vitest"; v.describe("suite", () => { v.test("passes", () => { expect(true).toBe(true); }); });',
]) {
	ruleStory.it(
		`tests/no-expect-in-support lets an unimported test-support module assert in the tests it registers with ${registration}`,
		[repositoryHas({ content: registration, path: "src/test-support/runner.ts" })],
		function* ({ check }) {
			expect(yield* check(noExpect)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/no-expect-in-support reports expect in an exported support verb and asks the verb to return the observed state",
	[
		repositoryHas({
			content: 'import { expect } from "vitest";\nexport function savesOrder() { expect(true).toBe(true); }',
			path: "src/test-support/orders.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(noExpect);

		expect(findings).toEqual([
			{
				file: "src/test-support/orders.ts",
				line: 2,
				message:
					"Calls expect in test-support. Return the engine's observed state from the verb and put the expectation in the spec; throw if an action cannot run.",
			},
		]);
	},
);

for (const consumer of [
	'import "./test-support/failingStories.ts";',
	'await import("./test-support/failingStories.ts");',
	'export * from "./test-support/failingStories.ts";',
]) {
	ruleStory.it(
		`tests/no-expect-in-support reports expect in a test-registering fixture that a spec consumes with ${consumer}`,
		[repositoryHas(FAILING_TESTS, { content: consumer, path: "src/runner.spec.ts" })],
		function* ({ check, locations }) {
			yield* check(noExpect);

			expect(yield* locations()).toEqual(["src/test-support/failingStories.ts:2"]);
		},
	);
}

ruleStory.it(
	"tests/no-expect-in-support reports expect in an exported helper that registers tests only when called",
	[repositoryHas({ content: 'export function orders() { it("fails", () => { expect(true).toBe(false); }); }', path: "src/test-support/orders.ts" })],
	function* ({ check, locations }) {
		yield* check(noExpect);

		expect(yield* locations()).toEqual(["src/test-support/orders.ts:1"]);
	},
);
