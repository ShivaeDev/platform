import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { kitFiles, spec } from "#quality-fixtures/storySpecFiles.ts";
import { storySpecs } from "#quality-internal/rules/stories/specs.ts";

ruleKit.it(
	"inline trait calls belong to the story registration",
	[
		repositoryHas(
			...kitFiles,
			spec(
				[
					'import { orders as engine } from "#test/orders.ts";',
					'engine.it("places an order", [engineConfiguration("configured engine", () => ({}))], () => {});',
					'engine.it("places another order", engineConfiguration("configured engine", () => ({})), () => {});',
				].join("\n"),
			),
		),
	],
	function* ({ checks }) {
		expect(yield* checks(storySpecs)).toEqual([]);
	},
);

for (const name of ["it", "test"]) {
	ruleKit.it(
		`a plain ${name} next to an inline trait still reports its own registration`,
		[
			repositoryHas(
				...kitFiles,
				spec(
					[
						'import { orders as engine } from "#test/orders.ts";',
						`import { ${name} as plain } from "vitest";`,
						'engine.it("places an order", [engineConfiguration("configured engine", () => ({}))], () => {});',
						'plain("plain registration", () => {});',
					].join("\n"),
				),
			),
		],
		function* ({ checks }) {
			expect(yield* checks(storySpecs)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 4 })]);
		},
	);
}
