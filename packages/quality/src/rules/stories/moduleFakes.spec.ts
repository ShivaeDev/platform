import { expect } from "@effect/vitest";
import { adapterOnlyFakes } from "#rules/stories/adapterOnlyFakes.ts";
import { fakeRepository, fakeSpec } from "#test/fakeRepository.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const call of [
	'vi.mock("./orders.ts");',
	'vi.doMock("./orders.ts", () => ({}));',
	'vi.mock(import("./orders.ts"));',
	'vi.mock("#orders");',
	'import { vi as fake } from "@effect/vitest"; fake.doMock("./orders.ts");',
	'import * as testing from "@effect/vitest"; testing.vi.mock("./orders.ts");',
] as const) {
	ruleStory.it(
		`tests/adapter-only-fakes reports an owned module replaced by ${call}`,
		[repositoryHas(...fakeRepository, fakeSpec(call))],
		function* ({ check }) {
			const findings = yield* check(adapterOnlyFakes);

			expect(findings).toEqual([
				{
					file: "src/orders.spec.ts",
					line: 1,
					message:
						"Replaces owned code in src/orders.ts outside adapters/. Exercise the real module or service; fake only adapters/ or outside libraries and platform globals. Delete a test whose failure can only be shown by faking internals.",
				},
			]);
		},
	);
}

for (const source of [
	'vi.mock("./adapters/mail.ts"); vi.doMock("#edge");',
	'vi.mock("vitest"); vi.doMock("node:fs");',
	'const fixture = `vi.mock("./orders.ts"); vi.doMock("./orders.ts");`;',
	'const vi = { mock: () => {} }; vi.mock("./orders.ts");',
] as const) {
	ruleStory.it(
		`tests/adapter-only-fakes accepts boundary fakes and fixture text: ${source}`,
		[repositoryHas(...fakeRepository, fakeSpec(source))],
		function* ({ check }) {
			expect(yield* check(adapterOnlyFakes)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/adapter-only-fakes checks module replacements inside test-support too",
	[repositoryHas(...fakeRepository, { content: 'vi.mock("../orders.ts");', path: "src/test-support/orders.ts" })],
	function* ({ check, locations }) {
		yield* check(adapterOnlyFakes);

		expect(yield* locations()).toEqual(["src/test-support/orders.ts:1"]);
	},
);
