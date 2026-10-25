import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { factoryFiles, kitFiles, spec } from "#quality-fixtures/storySpecFiles.ts";
import { storyEngine } from "#quality-internal/rules/stories/engine.ts";

for (const registration of [
	'orders.it("adds", [], () => { expect(add(1, 2)).toBe(3); });',
	'const title = "adds"; orders.it(title, [], () => { expect(add(1, 2)).toBe(3); });',
	'orders.it("adds", [] as const, () => { expect(add(1, 2)).toBe(3); });',
	'const { it: scenario } = orders; scenario("adds", [], () => { expect(add(1, 2)).toBe(3); });',
	'const scenario = orders.it; scenario("adds", [], () => { expect(add(1, 2)).toBe(3); });',
	'orders.it.runIf(true)("adds", [], () => { expect(add(1, 2)).toBe(3); });',
	'orders.it.skipIf(false)("adds", [], () => { expect(add(1, 2)).toBe(3); });',
	'function body() { expect(add(1, 2)).toBe(3); } orders.it("adds", [], body);',
	'orders.it("adds", []);',
]) {
	ruleKit.it(
		`the origin tracer recognizes a story that ignores its kit: ${registration}`,
		[repositoryHas(...kitFiles, spec(`import { app as orders } from "#test/index.ts";\n${registration}`))],
		function* ({ checks }) {
			expect(yield* checks(storyEngine)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 2 })]);
		},
	);
}

for (const factory of [
	"export function buildOrderKit() { const kit = storyKit({}); return { ...kit, extra: () => {} }; }",
	"export const buildOrderKit = () => storyKit({});",
]) {
	ruleKit.it(
		`a factory-built kit still reports a body that ignores it: ${factory}`,
		[
			repositoryHas(
				...factoryFiles(factory),
				spec('import { orders } from "#test/factoryOrders.ts";\norders.it("adds", [], () => { expect(add(1, 2)).toBe(3); });'),
			),
		],
		function* ({ checks }) {
			expect(yield* checks(storyEngine)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 2 })]);
		},
	);
}

ruleKit.it(
	"a plain registrar is left to story-specs",
	[repositoryHas(spec('const orders = { it() {} };\norders.it("adds", [], () => { expect(add(1, 2)).toBe(3); });'))],
	function* ({ checks }) {
		expect(yield* checks(storyEngine)).toEqual([]);
	},
);

ruleKit.it(
	"each story that ignores its kit reports its own line",
	[
		repositoryHas(
			...kitFiles,
			spec(
				'import { orders } from "#test/orders.ts";\norders.it("adds", [], () => {});\norders.it("subtracts", [], () => {});',
				"src/arithmetic.test.ts",
			),
		),
	],
	function* ({ checks }) {
		expect(yield* checks(storyEngine)).toEqual([
			expect.objectContaining({ file: "src/arithmetic.test.ts", line: 2, message: expect.stringContaining("arithmetic.unit.test.ts") }),
			expect.objectContaining({ file: "src/arithmetic.test.ts", line: 3 }),
		]);
	},
);
