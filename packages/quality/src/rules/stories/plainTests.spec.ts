import { expect } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { kitFiles, spec } from "#test/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

ruleStory.it(
	"tests/story-specs accepts a story declared through the package's re-exported kit",
	[repositoryHas(...kitFiles, spec('import { app as orders } from "#test/index.ts"; orders.it("saves an order", []);'))],
	function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	},
);

ruleStory.it(
	"tests/story-specs reports a plain Vitest file once, at its first test, and asks to declare every test through the kit's it",
	[repositoryHas(spec('import { it, test } from "vitest";\nit("adds", () => {});\ntest("subtracts", () => {});'))],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		expect(findings).toEqual([{ file: SPEC, line: 2, message: expect.stringContaining("declare every test through the kit's it") }]);
	},
);

ruleStory.it(
	"tests/story-specs names both repairs for a plain test outside a .unit file, keeping its kind and extension",
	[repositoryHas(spec('import { it } from "vitest";\nit("adds", () => {});', "src/checkoutFlow.dom.spec.tsx"))],
	function* ({ check, messages }) {
		yield* check(storySpecs);

		expect(yield* messages()).toEqual([
			"Declares tests without a test-story story kit. Drive the engine through the package's story kit: build it with storyKit from @shivaedev/test-story/server/storyKit.ts in src/test-support, and declare every test through the kit's it. If the code under test is pure, move the test to checkoutFlow.unit.spec.tsx, which reaches no engine and mocks nothing. See https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.",
		]);
	},
);

for (const [registration, content, line] of [
	[
		"a renamed Vitest it beside a story",
		'import { orders } from "#test/orders.ts"; import { it as plain } from "vitest"; orders.it("story", []); plain("plain", () => {});',
		1,
	],
	[
		"a Vitest it destructured from its namespace beside a story",
		'import * as v from "vitest";\nimport { orders } from "#test/orders.ts";\nconst { it: ordinary } = v;\nordinary("plain", () => {});\norders.it("story", [], () => {});',
		4,
	],
	[
		"a Vitest test destructured from its namespace beside a story",
		'import * as v from "vitest";\nimport { orders } from "#test/orders.ts";\nconst { test: ordinary } = v;\nordinary("plain", () => {});\norders.it("story", [], () => {});',
		4,
	],
	[
		"a registrar destructured through a namespace alias with an opaque body",
		'import * as v from "vitest";\nimport { orders } from "#test/orders.ts";\nconst runtime = v; const { test: ordinary } = runtime;\ndeclare const body: () => void;\nordinary("plain", body);\norders.it("story", [], body);',
		5,
	],
	[
		"an unrecognized registration beside a story inside a suite",
		'import { describe as group } from "vitest";\nimport { orders } from "#test/orders.ts";\ngroup("orders", () => {\n  orders.it("story", [], () => {});\n  scenario("plain", () => {});\n});',
		5,
	],
	[
		"an imported Vitest test registered inside a story",
		'import { orders } from "#test/orders.ts";\nimport { test } from "vitest";\norders.it("nested", [], () => { test("plain", () => {}); });',
		3,
	],
	[
		"a custom registration with a named callback inside a suite",
		'import { describe } from "vitest";\nfunction body() {}\ndescribe("orders", () => { scenario("plain", body); });',
		3,
	],
	[
		"an unrelated object's it",
		'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts"; const orders = { it() {} }; orders.it("plain", []);',
		1,
	],
	["a custom harness without a story kit", 'import { scenario } from "./test-support/harness.ts"; scenario("plain", function* () {});', 1],
] as const) {
	ruleStory.it(`tests/story-specs reports ${registration}`, [repositoryHas(...kitFiles, spec(content))], function* ({ check, locations }) {
		yield* check(storySpecs);

		expect(yield* locations()).toEqual([`${SPEC}:${line}`]);
	});
}

for (const [registration, path, content] of [
	[
		"a renamed Vitest test with a modifier and an opaque body",
		"src/renamed.test.ts",
		'import { test as scenario } from "vitest"; declare const body: () => void; scenario.each([1])("plain", body);',
	],
	[
		"a skipped test of the Vitest namespace with an opaque body",
		"src/namespace.test.ts",
		'import * as v from "vitest"; declare const body: () => void; v.test.skip("plain", body);',
	],
	[
		"a database tester read from a custom it",
		"src/custom.spec.ts",
		'const it = makeDatabaseIt({}); const effectDB = it.effectDB; effectDB("plain", function* () {});',
	],
] as const) {
	ruleStory.it(`tests/story-specs reports ${registration}`, [repositoryHas(spec(content, path))], function* ({ check, locations }) {
		yield* check(storySpecs);

		expect(yield* locations()).toEqual([`${path}:1`]);
	});
}

for (const [story, content] of [
	[
		"stories in a destructured suite whose bodies pass callbacks",
		'import * as v from "vitest";\nimport { orders } from "#test/orders.ts";\nconst { describe: group } = v;\ngroup("orders", () => {\n  orders.it("story", [], () => { engine.on("changed", () => {}); });\n});',
	],
	[
		"test-result inspection inside a story",
		'import { orders } from "#test/orders.ts";\norders.it("workers", [], ({ results }) => {\n  results.flatMap((test) => test.annotations());\n  for (const test of results) { test.result(); }\n});',
	],
	[
		"a story kit built locally, through a namespace factory and a destructured registrar",
		'import * as stories from "@shivaedev/test-story/server/storyKit.ts"; const app = stories.storyKit({}); const { it: scenario } = app; scenario("story", [], () => {});',
	],
	[
		"a spec with no test declarations, whose strings and regex test calls look like tests",
		"String(0); String(1); const example = 'it()'; /a/.test(example);",
	],
] as const) {
	ruleStory.it(`tests/story-specs accepts ${story}`, [repositoryHas(...kitFiles, spec(content))], function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	});
}

ruleStory.it(
	"tests/story-specs accepts stories through a conditional registrar and a kit extension",
	[
		repositoryHas(
			...kitFiles,
			{
				content: 'import { orders } from "./orders.ts"; export const app = { ...orders, it: orders.it.runIf(true) };',
				path: "src/test-support/conditional.ts",
			},
			spec('import { app } from "#test/conditional.ts"; const scenario = app.it; scenario("story", []); app.it.skipIf(false)("another story", []);'),
		),
	],
	function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	},
);

for (const [file, path] of [
	["a typecheck test", "src/orders.typecheck.test.ts"],
	["a source file", "src/orders.ts"],
] as const) {
	ruleStory.it(
		`tests/story-specs leaves the plain test in ${file} alone`,
		[repositoryHas(spec('import { test } from "vitest"; test("type only", () => {});', path))],
		function* ({ check }) {
			expect(yield* check(storySpecs)).toEqual([]);
		},
	);
}
