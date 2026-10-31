import { expect } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { kitFiles, spec } from "#test/storySpecFiles.ts";

for (const loop of [
	"for (const kit of kits)",
	"for (const kit of [orders, orders] as const)",
	'for (const [kit, label] of [[orders, "first"], [orders, "second"]] as const)',
]) {
	ruleStory.it(
		`kit collections register stories and remain checked for timed waits through ${loop}`,
		[
			repositoryHas(
				...kitFiles,
				{
					content: 'import { orders } from "./orders.ts"; export const kits = [orders, orders];',
					path: "src/test-support/orderKits.ts",
				},
				spec(
					`import { orders } from "#test/orders.ts"; import { kits } from "#test/orderKits.ts"; import { Effect } from "effect";\n${loop} { kit.it("waits", [], function* () { yield* Effect.sleep("1 second"); }); }`,
					"src/orders.test.ts",
				),
			),
		],
		function* ({ check, locations }) {
			expect(yield* check(storySpecs)).toEqual([]);

			yield* check(waitOnEvents);

			expect(yield* locations()).toEqual(["src/orders.test.ts:2"]);
		},
	);
}

ruleStory.it(
	"a collection containing a plain registrar still reports its uncovered test",
	[
		repositoryHas(
			...kitFiles,
			spec('import { orders } from "#test/orders.ts"; for (const kit of [orders, { it() {} }]) { kit.it("plain", [], () => {}); }'),
		),
	],
	function* ({ check, locations }) {
		yield* check(storySpecs);

		expect(yield* locations()).toEqual(["src/orders.spec.ts:1"]);
	},
);
