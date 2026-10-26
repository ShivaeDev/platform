import { describe, expect, it } from "vitest";
import { testsColocated } from "#rules/test-names/colocated.ts";
import { checkRule } from "#test/inputs.ts";

const files = [
	"src/cart/cart.ts",
	"src/cart/cart.test.ts",
	"src/cart/checkoutFlow.spec.ts",
	"packages/cart/test/cart.test.ts",
	"packages/cart/test/support/seed.ts",
	"src/cart/__tests__/cart.test.tsx",
	"tests/cart/cart.dom.test.ts",
	"src/spec/cart.spec.ts",
	"tests/smoke/checkout.spec.ts",
	"src/testing/cart.test.ts",
];

describe("tests/colocated", () => {
	it("flags tests-only test, tests and spec folders and every __tests__ folder outside declared suites", async () => {
		const findings = await checkRule(testsColocated, { suites: ["tests/smoke/"] }, { files });
		expect(findings.map((finding) => finding.file)).toEqual([
			"packages/cart/test/cart.test.ts",
			"src/cart/__tests__/cart.test.tsx",
			"tests/cart/cart.dom.test.ts",
			"src/spec/cart.spec.ts",
		]);
	});

	it("says where the test belongs", async () => {
		const findings = await checkRule(testsColocated, undefined, { files: ["packages/cart/test/cart.test.ts"] });
		expect(findings).toEqual([
			{
				file: "packages/cart/test/cart.test.ts",
				message:
					'Sits in the test folder "test/". A test, tests or spec folder is test-only when its directly contained checked files are all tests or test support; __tests__ is always a test folder. A test sits beside the file it covers, as cart.test.ts beside cart.ts, or as a <behaviour>.spec.ts at the module root or directly beside the module folder. Shared test support belongs in test-support/. A folder of tests that cover several packages is a suite in the "suites" option.',
			},
		]);
	});

	it("keeps a unit test's modifier in the name it suggests", async () => {
		const findings = await checkRule(testsColocated, undefined, { files: ["src/tests/cart.unit.test.ts"] });
		expect(findings.map((finding) => finding.message)).toEqual([
			'Sits in the test folder "tests/". A test, tests or spec folder is test-only when its directly contained checked files are all tests or test support; __tests__ is always a test folder. A test sits beside the file it covers, as cart.unit.test.ts beside cart.ts, or as a <behaviour>.unit.spec.ts at the module root or directly beside the module folder. Shared test support belongs in test-support/. A folder of tests that cover several packages is a suite in the "suites" option.',
		]);
	});
});
