import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { testsColocated } from "#quality-internal/rules/test-names/colocated.ts";

for (const folder of ["test", "tests", "spec"]) {
	ruleKit.it(
		`a spec beside its screen in a product's ${folder} folder is colocated`,
		[
			repositoryHas(
				{ content: "export const TestsScreen = () => null;", path: `src/client/${folder}/TestsScreen.tsx` },
				{ content: "", path: `src/client/${folder}/testsScreen.spec.ts` },
			),
		],
		function* ({ checks }) {
			expect(yield* checks(testsColocated)).toEqual([]);
		},
	);
}

for (const folder of ["tests", "src/tests"]) {
	ruleKit.it(
		`a tests-only ${folder} folder separates tests from their source`,
		[
			repositoryHas(
				{ content: "export const cart = 1;", path: "src/cart/cart.ts" },
				{ content: "", path: `${folder}/cart.spec.ts` },
				{ content: "export const seed = 1;", path: `${folder}/test-support/seed.ts` },
			),
		],
		function* ({ checks }) {
			expect(yield* checks(testsColocated)).toEqual([expect.objectContaining({ file: `${folder}/cart.spec.ts` })]);
		},
	);
}

ruleKit.it(
	"an __tests__ folder remains a test folder even with source beside its spec",
	[
		repositoryHas(
			{ content: "export const cart = 1;", path: "src/cart/cart.ts" },
			{ content: "export const cart = 1;", path: "src/cart/__tests__/cart.ts" },
			{ content: "", path: "src/cart/__tests__/cart.spec.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(testsColocated)).toEqual([expect.objectContaining({ file: "src/cart/__tests__/cart.spec.ts" })]);
	},
);

ruleKit.it(
	"a whole-module spec can sit at the module root or beside its folder",
	[
		repositoryHas(
			{ content: "export const cart = 1;", path: "src/cart/cart.ts" },
			{ content: "", path: "src/cart/checkout.spec.ts" },
			{ content: "", path: "src/cart.spec.ts" },
			{ content: "export const seed = 1;", path: "src/cart/test-support/seed.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(testsColocated)).toEqual([]);
	},
);
