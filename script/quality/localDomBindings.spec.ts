import { expect } from "vitest";
import { storySpecs } from "@shivaedev/quality/rules/stories/specs.ts";
import { testsFollow } from "@shivaedev/quality/rules/test-names/follow.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { ordersPackage, pureOrders, unitSpec } from "#quality/test-support/unitFiles.ts";

for (const binding of [
	'const document = { body: "order" }; export const body = document.body;',
	"export function body(document: { body: string }) { return document.body; }",
	'const { document } = { document: { body: "order" } }; export const body = document.body;',
	"export function body({ document }: { document: { body: string } }) { return document.body; }",
]) {
	ruleKit.it(
		`a locally bound document passes in a unit test and its fixture: ${binding}`,
		[repositoryHas(ordersPackage, pureOrders, unitSpec(binding))],
		function* ({ checks, writes }) {
			expect(yield* checks(storySpecs)).toEqual([]);
			expect(yield* checks(testsFollow)).toEqual([]);
			yield* writes(
				{ content: binding, path: "src/test-support/document.ts" },
				unitSpec('import { body } from "./test-support/document.ts"; export const value = body;'),
			);
			expect(yield* checks(storySpecs)).toEqual([]);
		},
	);
}

for (const access of ["document.body", "window.location"]) {
	ruleKit.it(
		`a global DOM access is still reported beside local bindings: ${access}`,
		[
			repositoryHas(
				ordersPackage,
				pureOrders,
				unitSpec(`function body(document: { body: string }) { return document.body; }\nexport const value = ${access};`),
			),
		],
		function* ({ checks }) {
			expect(yield* checks(storySpecs)).toEqual([
				{ file: "src/orders.unit.test.ts", line: 1, message: expect.stringContaining("Is a unit test but uses the DOM.") },
			]);
			expect(yield* checks(testsFollow)).toEqual([
				{ file: "src/orders.unit.test.ts", message: expect.stringContaining('"orders.unit.test.ts" uses the DOM') },
			]);
		},
	);
}
