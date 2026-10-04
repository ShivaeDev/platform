import { describe, expect, it } from "vitest";
import { testsColocated } from "#rules/test-names/colocated.ts";
import { checkRule } from "#test/support/inputs.ts";

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
	it("flags a test in a test, tests, __tests__ or spec folder, unless the folder is a declared suite", async () => {
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
					'Sits in the test folder "test/". A test sits beside the file it covers, as cart.test.ts beside cart.ts, or as a <behaviour>.spec.ts in the folder it covers. A folder of tests that cover several packages is a suite in the "suites" option.',
			},
		]);
	});
});
