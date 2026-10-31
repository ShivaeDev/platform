import { expect } from "vitest";
import { testsColocated } from "#rules/test-names/colocated.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const SUITES = { suites: ["tests/smoke/"] };

ruleStory.it(
	"tests/colocated reports a test in a test-only folder and says where the test belongs",
	[repositoryHas({ content: "", path: "packages/cart/test/cart.test.ts" })],
	function* ({ check }) {
		const findings = yield* check(testsColocated);

		expect(findings).toEqual([
			{
				file: "packages/cart/test/cart.test.ts",
				message:
					'Sits in the test folder "test/". A test, tests or spec folder is test-only when its directly contained checked files are all tests or test support; __tests__ is always a test folder. A test sits beside the file it covers, as cart.test.ts beside cart.ts, or as a <behaviour>.spec.ts at the module root or directly beside the module folder. Shared test support belongs in test-support/. A folder of tests that cover several packages is a suite in the "suites" option.',
			},
		]);
	},
);

ruleStory.it(
	"tests/colocated keeps a unit test's modifier in the names it suggests",
	[repositoryHas({ content: "", path: "src/tests/cart.unit.test.ts" })],
	function* ({ check, messages }) {
		yield* check(testsColocated);

		expect(yield* messages()).toEqual([
			'Sits in the test folder "tests/". A test, tests or spec folder is test-only when its directly contained checked files are all tests or test support; __tests__ is always a test folder. A test sits beside the file it covers, as cart.unit.test.ts beside cart.ts, or as a <behaviour>.unit.spec.ts at the module root or directly beside the module folder. Shared test support belongs in test-support/. A folder of tests that cover several packages is a suite in the "suites" option.',
		]);
	},
);

const misplaced = [
	[
		"a test in a __tests__ folder, even one that holds source",
		"src/cart/__tests__/cart.test.tsx",
		[{ content: "", path: "src/cart/__tests__/helper.ts" }],
	],
	["a test in a tests folder that is not a declared suite", "tests/cart/cart.dom.test.ts", []],
	["a spec in a spec folder", "src/spec/cart.spec.ts", []],
] as const;

for (const [test, path, beside] of misplaced) {
	ruleStory.it(`tests/colocated reports ${test}`, [repositoryHas({ content: "", path }, ...beside)], function* ({ check, locations }) {
		yield* check(testsColocated, SUITES);

		expect(yield* locations()).toEqual([path]);
	});
}

const placed = [
	["a spec in a declared suite", ["tests/smoke/checkout.spec.ts"]],
	["a test in a folder named testing", ["src/testing/cart.test.ts"]],
	["a test in a test folder that also holds the file it covers", ["src/test/helper.ts", "src/test/helper.test.ts"]],
] as const;

for (const [test, paths] of placed) {
	ruleStory.it(`tests/colocated accepts ${test}`, [repositoryHas(...paths.map((path) => ({ content: "", path })))], function* ({ check }) {
		expect(yield* check(testsColocated, SUITES)).toEqual([]);
	});
}
