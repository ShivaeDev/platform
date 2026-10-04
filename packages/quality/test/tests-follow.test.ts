import { describe, expect, it } from "vitest";
import { testsFollow } from "#rules/test-names/follow.ts";
import { checkRule } from "#test/support/inputs.ts";
import type { SeedFile } from "#test/support/tree.ts";

function code(path: string, content = "export {};\n"): SeedFile {
	return { content, path };
}

const sources = [
	code("src/cart/cart.ts"),
	code("src/cart/cart.test.ts"),
	code("src/cart/cart.slow.test.ts"),
	code("src/cart/cart.typecheck.test.ts"),
	code("src/cart/checkoutFlow.spec.ts"),
	code("src/cart/checkoutFlow.dom.spec.tsx", 'import { render } from "@testing-library/react";\n'),
	code("src/cart/Basket.tsx"),
	code("src/cart/Basket.dom.test.tsx", "document.body.append(node);\n"),
	code("src/cart/totals.test.ts"),
	code("src/cart/cart.spec.ts"),
	code("src/cart/checkout-flow.spec.ts"),
	code("src/cart/cart.hydration.test.ts"),
	code("src/cart/cart.dom.slow.test.ts"),
	code("src/cart/cart.postgres.test.ts"),
	code("src/cart/Basket.test.tsx", 'import { render } from "@testing-library/react";\n'),
	code("e2e/checkout.spec.ts", "window.location.reload();\n"),
];

describe("tests/follow", () => {
	it("passes a .test beside its file and a camelCase .spec with at most one environment, and flags every other name", async () => {
		const findings = await checkRule(testsFollow, { suites: ["e2e/"] }, { sources });
		expect(findings.map((finding) => finding.file)).toEqual([
			"src/cart/totals.test.ts",
			"src/cart/cart.spec.ts",
			"src/cart/checkout-flow.spec.ts",
			"src/cart/cart.hydration.test.ts",
			"src/cart/cart.dom.slow.test.ts",
			"src/cart/cart.postgres.test.ts",
			"src/cart/Basket.test.tsx",
		]);
	});

	it("names the valid shape in each message", async () => {
		const findings = await checkRule(testsFollow, { suites: ["e2e/"] }, { sources });
		expect(findings.map((finding) => finding.message)).toEqual([
			'"totals.test.ts" follows no file: totals.test.ts sits beside totals.ts in the same folder. A test that covers the folder as a whole is a <behaviour>.spec.ts, such as checkoutFlow.spec.ts.',
			'"cart.spec.ts" shares its name with cart.ts. A .spec names a behaviour of its folder, such as checkoutFlow.spec.ts; a test of cart.ts is cart.test.ts.',
			'"checkout-flow.spec.ts" names its behaviour in camelCase, such as checkoutFlow.spec.ts.',
			'"cart.hydration.test.ts" has the suffixes ".hydration". A test file is <file>[.<environment>].test.ts beside its file or <behaviour>[.<environment>].spec.ts in the folder it covers, with at most one environment of dom, slow and typecheck. An aspect of a module gets its own file in the module\'s folder, or a .spec.',
			'"cart.dom.slow.test.ts" has the suffixes ".dom.slow". A test file is <file>[.<environment>].test.ts beside its file or <behaviour>[.<environment>].spec.ts in the folder it covers, with at most one environment of dom, slow and typecheck. An aspect of a module gets its own file in the module\'s folder, or a .spec.',
			'".postgres" is not a test environment. A test that needs a database or a running app takes it from the app\'s test fixture and is named like any other test. A test file is <file>[.<environment>].test.ts beside its file or <behaviour>[.<environment>].spec.ts in the folder it covers, with at most one environment of dom, slow and typecheck.',
			'"Basket.test.tsx" uses the DOM, so it is Basket.dom.test.tsx and runs in the dom project.',
		]);
	});

	it("checks the tests of a folder that is not declared as a suite", async () => {
		const findings = await checkRule(testsFollow, undefined, { sources: [code("e2e/checkout.spec.ts", "window.location.reload();\n")] });
		expect(findings.map((finding) => finding.message)).toEqual([
			'"checkout.spec.ts" uses the DOM, so it is checkout.dom.spec.ts and runs in the dom project.',
		]);
	});
});
