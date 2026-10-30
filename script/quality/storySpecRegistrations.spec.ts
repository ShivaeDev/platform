import { expect } from "vitest";
import { storySpecs } from "@shivaedev/quality/rules/stories/specs.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { factoryFiles, kitFiles, spec } from "#quality-fixtures/storySpecFiles.ts";

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

ruleKit.it(
	"an imported factory returns a kit with extra helpers",
	[
		repositoryHas(
			...factoryFiles("export function buildOrderKit() { const kit = storyKit({}); return { ...kit, extra: () => {} }; }"),
			spec('import { orders } from "#test/factoryOrders.ts";\norders.it("places an order", [], () => {});'),
		),
	],
	function* ({ checks }) {
		expect(yield* checks(storySpecs)).toEqual([]);
	},
);

for (const name of ["it", "test"]) {
	ruleKit.it(
		`a plain ${name} beside a factory-built kit reports its own line`,
		[
			repositoryHas(
				...factoryFiles("export function buildOrderKit() { const kit = storyKit({}); return { ...kit, extra: () => {} }; }"),
				spec(
					[
						'import { orders } from "#test/factoryOrders.ts";',
						`import { ${name} } from "vitest";`,
						'orders.it("places an order", [], () => {});',
						`${name}("plain registration", () => {});`,
					].join("\n"),
				),
			),
		],
		function* ({ checks }) {
			expect(yield* checks(storySpecs)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 4 })]);
		},
	);
}

ruleKit.it(
	"a factory returning no kit still reports its registration",
	[
		repositoryHas(
			...factoryFiles("export function buildOrderKit() { const unused = () => storyKit({}); return { it: () => {}, extra: unused }; }"),
			spec('import { orders } from "#test/factoryOrders.ts";\norders.it("plain registration", [], () => {});'),
		),
	],
	function* ({ checks }) {
		expect(yield* checks(storySpecs)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 2 })]);
	},
);

for (const factory of ["function buildOrderKit() { return storyKit({}); }", "const buildOrderKit = () => storyKit({});"]) {
	ruleKit.it(
		`a local factory returns a kit directly: ${factory}`,
		[
			repositoryHas(
				...kitFiles,
				spec(
					[
						'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";',
						factory,
						"const orders = buildOrderKit();",
						'orders.it("places an order", [], () => {});',
					].join("\n"),
				),
			),
		],
		function* ({ checks }) {
			expect(yield* checks(storySpecs)).toEqual([]);
		},
	);
}
