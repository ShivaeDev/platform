import { expect } from "@effect/vitest";
import { fakeRepository, fakeSpec } from "#test/fakeRepository.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { adapterOnlyFakes } from "./adapterOnlyFakes.ts";

for (const replacement of [
	'vi.spyOn(orders, "total").mockImplementation(() => 2);',
	'vi.spyOn(orders, "total").mockImplementationOnce(() => 2);',
	'vi.spyOn(orders, "total").mockReturnValue(2);',
	'const target = orders; vi["spyOn"](target, "total")["mockReturnValue"](2);',
	'vi.spyOn(orders, "total").mockResolvedValueOnce(2);',
	'vi.spyOn(orders, "total").mockRejectedValue(new Error());',
	'const spy = vi.spyOn(orders, "total"); spy.mockReturnValueOnce(2);',
	'const spy = vi.spyOn(orders, "total"); const alias = spy; alias.withImplementation(() => 2, () => {});',
] as const) {
	ruleStory.it(
		`tests/adapter-only-fakes reports an owned export replaced by ${replacement}`,
		[repositoryHas(...fakeRepository, fakeSpec(`import { orders } from "./published.ts";\n${replacement}`))],
		function* ({ check }) {
			const findings = yield* check(adapterOnlyFakes);

			expect(findings).toEqual([
				{
					file: "src/orders.spec.ts",
					line: 2,
					message: expect.stringContaining("Replaces owned code in src/orders.ts"),
				},
			]);
		},
	);
}

for (const source of [
	'import { orders } from "./orders.ts"; vi.spyOn(orders, "total");',
	'import * as orders from "./orders.ts"; vi.spyOn(orders, "orders").mockRestore();',
	'import { mail } from "./adapters/mail.ts"; vi.spyOn(mail, "send").mockReturnValue(2);',
	'import * as fs from "node:fs"; vi.spyOn(fs, "readFileSync").mockImplementation(() => "");',
	'vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error());',
	'vi.spyOn(Math, "random").mockReturnValue(0);',
	'const fixture = `vi.spyOn(orders, "total").mockReturnValue(2);`;',
] as const) {
	ruleStory.it(
		`tests/adapter-only-fakes accepts observing spies and boundary replacements: ${source}`,
		[repositoryHas(...fakeRepository, fakeSpec(source))],
		function* ({ check }) {
			expect(yield* check(adapterOnlyFakes)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/adapter-only-fakes resolves a replacement spy on a module namespace",
	[repositoryHas(...fakeRepository, fakeSpec('import * as orders from "./orders.ts";\nvi.spyOn(orders, "orders").mockReturnValue({});'))],
	function* ({ check, locations }) {
		yield* check(adapterOnlyFakes);

		expect(yield* locations()).toEqual(["src/orders.spec.ts:2"]);
	},
);

ruleStory.it(
	"tests/adapter-only-fakes reports a replacement spy on an owned test-support export",
	[
		repositoryHas(
			...fakeRepository,
			{ content: "export const submit = () => 1;", path: "src/test-support/engine.ts" },
			fakeSpec('import * as engine from "./test-support/engine.ts";\nvi.spyOn(engine, "submit").mockImplementation(() => 2);'),
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterOnlyFakes);

		expect(findings).toEqual([{ file: "src/orders.spec.ts", line: 2, message: expect.stringContaining("src/test-support/engine.ts") }]);
	},
);
