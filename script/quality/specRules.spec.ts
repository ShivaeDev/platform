import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { namedValues } from "#quality-internal/rules/stories/namedValues.ts";
import { noExpect } from "#quality-internal/rules/stories/noExpect.ts";
import { noLimitImports } from "#quality-internal/rules/stories/noLimitImports.ts";
import { specHelpers } from "#quality-internal/rules/stories/specHelpers.ts";

ruleKit.it(
	"a spec author moves top-level functions and function values into the kit",
	[
		repositoryHas({
			content:
				'function ordered() {}\nconst basket = (() => ({}));\nconst prices = function () {};\nexport default function () {}\nconst read = Effect.fn("read")(function* () {});',
			path: "src/orders.spec.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(specHelpers);
		expect(findings.map((finding) => finding.line)).toEqual([1, 2, 3, 4, 5]);
		expect(findings[0]?.message).toContain("story kit's verbs");
	},
);

ruleKit.it(
	"a story uses kit actions while source and test-support may define helpers",
	[
		repositoryHas(
			{ content: 'orders.it("places an order", [], function* ({ places }) { yield* places(); });', path: "src/orders.spec.ts" },
			{ content: "export function ordered() {}", path: "src/orders.ts" },
			{ content: "export const basket = () => ({});", path: "src/test-support/orders.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(specHelpers)).toEqual([]);
	},
);

ruleKit.it(
	"test-support leaves expectations in the spec, including renamed and namespace calls",
	[
		repositoryHas({
			content:
				'import { expect as assert } from "vitest"; import * as v from "vitest";\nassert(actual).toEqual(wanted);\nv.expect(actual).toBeTruthy();\nexpect(actual).toBeDefined();\nexpect.soft(actual).toBeTruthy();',
			path: "src/test-support/orders.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(noExpect);
		expect(findings.map((finding) => finding.line)).toEqual([2, 3, 4, 5]);
		expect(findings[0]?.message).toContain("put the expectation in the spec");
	},
);

ruleKit.it(
	"verbs expose observations and fail when they cannot act; specs assert them",
	[
		repositoryHas(
			{
				content: 'export function orders() { if (!button) throw new Error("Missing order button"); return engine.orders; }',
				path: "src/test-support/orders.ts",
			},
			{ content: "expect(engine.orders).toEqual([placed]);", path: "src/orders.spec.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(noExpect)).toEqual([]);
	},
);

ruleKit.it(
	"a spec names numeric expectations instead of passing bare literals to matchers",
	[
		repositoryHas({
			content:
				'expect(items).toHaveLength(2);\nexpect(total).not.toBe(-1);\nexpect(total)["toBe"]((+3));\nexpect(result.statusCount).toBe(2);\nexpect(response.body.length).toBe(4);\nexpect(codex).toBe(2);\nexpect(exitCodes).not.toHaveLength((-2));\nexpect.soft(total).not.toBe((+5));',
			path: "src/orders.spec.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(namedValues);
		expect(findings.map((finding) => finding.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(findings[0]?.message).toContain("Assert the observed items");
	},
);

ruleKit.it(
	"a spec asserts observed items or a domain-named value",
	[
		repositoryHas(
			{
				content:
					'expect(items).toEqual([placed]); const shipped = 2; expect(count).toBe(shipped); expect(items).toHaveLength(orders.length);\nexpect(items).toHaveLength(0);\nexpect(total).toBe(0);\nexpect(result.status).toBe(1);\nexpect(response.status).toBe(404);\nexpect(run()["code"]).toBe(2);\nexpect(exitCode).toBe(3);\nexpect(total).not.toBe(-0);\nexpect(items).toHaveLength((0));\nexpect.soft((response.status)).not.toBe((+500));\nexpect((yield* signIn()).status).toBe(200);\nexpect(process.exitCode).not.toBe(-1);\nexpect(status).toBe(201);\nexpect(code).toHaveLength(2);\nexpect.soft(run()["exitCode"]).toBe(3);',
				path: "src/orders.spec.ts",
			},
			{ content: "expect(sum).toBe(2);", path: "src/value.test.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(namedValues)).toEqual([]);
	},
);

ruleKit.it(
	"a spec cannot import implementation caps even under another name",
	[
		repositoryHas({
			content:
				'import { MAX_ITEMS as cap } from "./limits.ts";\nimport * as limits from "#limits.ts";\nexpect(count).toBe(limits.MAX_ITEMS); limits["MAX_ITEMS"];',
			path: "src/orders.spec.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(noLimitImports);
		expect(findings.map((finding) => finding.line)).toEqual([1, 3, 3]);
		expect(findings[0]?.message).toContain("observed behavior");
	},
);

ruleKit.it(
	"a spec uses observations without importing caps, and source may use its limits",
	[
		repositoryHas(
			{ content: 'import { itemSchema } from "./schemas.ts"; expect(items).toEqual([placed]);', path: "src/orders.spec.ts" },
			{ content: 'import { MAX_ITEMS } from "./limits.ts";', path: "src/orders.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(noLimitImports)).toEqual([]);
	},
);
