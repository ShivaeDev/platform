import { PURE_REPAIR } from "#adapters/units/runtime.ts";
import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { ordersPackage, unitSpec } from "#test/unitFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const UNIT = "src/orders.unit.test.ts";

for (const [terminal, what, line] of [
	['import { Effect } from "effect";\nexport const check = () => Effect.runPromise(Effect.void);', "Effect.runPromise", 2],
	['import { Clock as Time } from "effect";\nexport const check = Time.currentTimeMillis;', "Clock", 1],
	['export { runSync as check } from "effect/Effect";', "Effect.runSync", 1],
	['export * from "effect/Effect";', "Effect.run*", 1],
	['import { Effect } from "effect";\nexport const check = Effect.runPromise;', "Effect.runPromise", 2],
	['import { Effect } from "effect";\nconst run = Effect.runSync;\nexport { run as check };', "Effect.runSync", 2],
	['import { Effect } from "effect";\nexport const check = (programs) => programs.map(Effect.runPromise);', "Effect.runPromise", 2],
] as const) {
	ruleStory.it(
		`tests/story-specs reports a transitive production helper reaching ${what}: ${terminal}`,
		[
			repositoryHas(
				ordersPackage,
				{ content: terminal, path: "src/checkRule.ts" },
				{ content: 'export * from "./checkRule.ts";', path: "src/helpers.ts" },
				unitSpec('// pure setup\nimport * as helper from "./helpers.ts";\nhelper.runSync?.(program);'),
			),
		],
		function* ({ check }) {
			const findings = yield* check(storySpecs);

			yield* assertThat(findings, (actual) =>
				actual.toEqual([
					{
						file: UNIT,
						line: 2,
						message: `This \`.unit\` test reaches \`${what}\` through \`src/helpers.ts -> src/checkRule.ts:${line}\`. ${PURE_REPAIR}`,
					},
				]),
			);
		},
	);
}

ruleStory.it(
	"tests/story-specs follows the shared it.effect adapter to its Effect runner",
	[
		repositoryHas(
			ordersPackage,
			{ content: '{"name":"@shivaedev/test","exports":{"./adapters/it.ts":"./src/adapters/it.ts"}}', path: "packages/test/package.json" },
			{ content: 'import { execute } from "./runEffectTest.ts";\nexport const it = { effect: execute };', path: "packages/test/src/adapters/it.ts" },
			{
				content: 'import { Effect } from "effect";\nexport const execute = (program: Effect.Effect<void>) => Effect.runPromise(program);',
				path: "packages/test/src/adapters/runEffectTest.ts",
			},
			{ content: 'packages:\n  - "packages/*"\n', path: "pnpm-workspace.yaml" },
			unitSpec('import { it } from "@shivaedev/test/adapters/it.ts";\nit.effect(program);'),
		),
		repositoryLinks("node_modules/@shivaedev/test", "../../packages/test"),
	],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: UNIT,
					line: 1,
					message: `This \`.unit\` test reaches \`Effect.runPromise\` through \`packages/test/src/adapters/it.ts -> packages/test/src/adapters/runEffectTest.ts:2\`. ${PURE_REPAIR}`,
				},
			]),
		);
	},
);

for (const declaration of [
	'import type { Check } from "./checkRule.ts";',
	'import { type Check } from "./checkRule.ts";',
	'export { type Check } from "./checkRule.ts";',
	'import { type Clock } from "./checkRule.ts";',
	'export { type Clock } from "./checkRule.ts";',
	'import type { Clock } from "./checkRule.ts";',
	'import { type runPromise } from "./checkRule.ts";',
	'export { type runPromise } from "./checkRule.ts";',
]) {
	ruleStory.it(
		`tests/story-specs ignores a type-only import chain: ${declaration}`,
		[
			repositoryHas(
				ordersPackage,
				{
					content:
						'import { Effect, Clock } from "effect";\nexport type Check = typeof Clock; Effect.runSync(program);\nexport { Clock }; export { runPromise } from "effect/Effect";',
					path: "src/checkRule.ts",
				},
				unitSpec(declaration),
			),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(storySpecs), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"tests/story-specs points to the first relevant import even when a later import has a shorter path",
	[
		repositoryHas(
			ordersPackage,
			{ content: 'export * from "./middle.ts";', path: "src/early.ts" },
			{ content: 'export * from "./checkRule.ts";', path: "src/middle.ts" },
			{ content: 'import { Effect } from "effect";\nexport const check = () => Effect.runPromise(program);', path: "src/checkRule.ts" },
			unitSpec('import { check } from "./early.ts";\nimport "./checkRule.ts";'),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: UNIT,
					line: 1,
					message: `This \`.unit\` test reaches \`Effect.runPromise\` through \`src/early.ts -> src/middle.ts -> src/checkRule.ts:2\`. ${PURE_REPAIR}`,
				},
			]),
		);
	},
);
