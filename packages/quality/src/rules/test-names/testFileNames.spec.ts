import { expect } from "vitest";
import { testsFollow } from "#rules/test-names/follow.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const CART = { content: "export {};\n", path: "src/cart/cart.ts" };
const BASKET = { content: "export {};\n", path: "src/cart/Basket.tsx" };
const RENDERS = 'import { render } from "@testing-library/react";\n';
const GRAMMAR =
	"A test file is <file>[.<modifier>].test.ts beside its file or <behaviour>[.<modifier>].spec.ts in the folder it covers, with at most one modifier of dom, slow, typecheck and unit.";

const misnamed = [
	[
		"a test that follows no file",
		{ content: "export {};\n", path: "src/cart/totals.test.ts" },
		'"totals.test.ts" follows no file: totals.test.ts sits beside totals.ts in the same folder. A test that covers the folder as a whole is a <behaviour>.spec.ts, such as checkoutFlow.spec.ts.',
	],
	[
		"a spec named after the file beside it",
		{ content: "export {};\n", path: "src/cart/cart.spec.ts" },
		'"cart.spec.ts" shares its name with cart.ts. A .spec names a behaviour of its folder, such as checkoutFlow.spec.ts; a test of cart.ts is cart.test.ts.',
	],
	[
		"a kebab-case spec",
		{ content: "export {};\n", path: "src/cart/checkout-flow.spec.ts" },
		'"checkout-flow.spec.ts" names its behaviour in camelCase, such as checkoutFlow.spec.ts.',
	],
	[
		"a test with a suffix that is no modifier",
		{ content: "export {};\n", path: "src/cart/cart.hydration.test.ts" },
		`"cart.hydration.test.ts" has the suffixes ".hydration". ${GRAMMAR} An aspect of a module gets its own file in the module's folder, or a .spec.`,
	],
	[
		"a test with two modifiers",
		{ content: "export {};\n", path: "src/cart/cart.dom.slow.test.ts" },
		`"cart.dom.slow.test.ts" has the suffixes ".dom.slow". ${GRAMMAR} An aspect of a module gets its own file in the module's folder, or a .spec.`,
	],
	[
		"a test named after its database",
		{ content: "export {};\n", path: "src/cart/cart.postgres.test.ts" },
		`".postgres" is not a test environment. A test that needs a database or a running app takes it from the app's test fixture and is named like any other test. ${GRAMMAR}`,
	],
	[
		"a test that renders without the dom modifier",
		{ content: RENDERS, path: "src/cart/Basket.test.tsx" },
		'"Basket.test.tsx" uses the DOM, so it is Basket.dom.test.tsx and runs in the dom project.',
	],
	[
		"a spec that uses the DOM outside a declared suite",
		{ content: "window.location.reload();\n", path: "e2e/checkout.spec.ts" },
		'"checkout.spec.ts" uses the DOM, so it is checkout.dom.spec.ts and runs in the dom project.',
	],
	[
		"a unit test that follows no file",
		{ content: "export {};\n", path: "src/cart/totals.unit.test.ts" },
		'"totals.unit.test.ts" follows no file: totals.unit.test.ts sits beside totals.ts in the same folder. A test that covers the folder as a whole is a <behaviour>.spec.ts, such as checkoutFlow.unit.spec.ts.',
	],
	[
		"a unit spec named after the file beside it",
		{ content: "export {};\n", path: "src/cart/cart.unit.spec.ts" },
		'"cart.unit.spec.ts" shares its name with cart.ts. A .spec names a behaviour of its folder, such as checkoutFlow.unit.spec.ts; a test of cart.ts is cart.unit.test.ts.',
	],
	[
		"a test that is both unit and dom",
		{ content: "export {};\n", path: "src/cart/cart.unit.dom.test.ts" },
		'"cart.unit.dom.test.ts" is both a unit and a DOM test, but a unit test runs without the DOM. Drive the DOM through the package\'s story kit in cart.dom.test.ts, or keep only pure code in cart.unit.test.ts.',
	],
	[
		"a unit test that uses the DOM",
		{ content: "document.body.append(node);\n", path: "src/cart/Basket.unit.test.tsx" },
		'"Basket.unit.test.tsx" uses the DOM, so it is Basket.dom.test.tsx, not a unit test, and drives the DOM through the package\'s story kit and runs in the dom project.',
	],
] as const;

for (const [test, file, message] of misnamed) {
	ruleStory.it(`tests/follow reports ${test} and names the valid shape`, [repositoryHas(CART, BASKET, file)], function* ({ check, findings }) {
		yield* check(testsFollow);

		expect(yield* findings()).toEqual([{ file: file.path, message }]);
	});
}

const named = [
	["a test beside its file", { content: "export {};\n", path: "src/cart/cart.test.ts" }],
	["a slow test beside its file", { content: "export {};\n", path: "src/cart/cart.slow.test.ts" }],
	["a typecheck test beside its file", { content: "export {};\n", path: "src/cart/cart.typecheck.test.ts" }],
	["a unit test beside its file", { content: "export {};\n", path: "src/cart/cart.unit.test.ts" }],
	["a camelCase behaviour spec", { content: "export {};\n", path: "src/cart/checkoutFlow.spec.ts" }],
	["a camelCase unit spec", { content: "export {};\n", path: "src/cart/checkoutFlow.unit.spec.ts" }],
	["a dom spec that renders", { content: RENDERS, path: "src/cart/checkoutFlow.dom.spec.tsx" }],
	["a dom test that uses the DOM", { content: "document.body.append(node);\n", path: "src/cart/Basket.dom.test.tsx" }],
] as const;

for (const [test, file] of named) {
	ruleStory.it(`tests/follow accepts ${test}`, [repositoryHas(CART, BASKET, file)], function* ({ check }) {
		expect(yield* check(testsFollow)).toEqual([]);
	});
}

ruleStory.it(
	"tests/follow leaves a spec in a declared suite alone, even one that uses the DOM",
	[repositoryHas({ content: "window.location.reload();\n", path: "e2e/checkout.spec.ts" })],
	function* ({ check }) {
		expect(yield* check(testsFollow, { suites: [{ glob: "e2e/", reason: "This suite covers several modules." }] })).toEqual([]);
	},
);
