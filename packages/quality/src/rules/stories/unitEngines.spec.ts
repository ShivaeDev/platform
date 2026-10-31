import { expect } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { orders, ordersPackage, pureOrders, unitSpec } from "#test/unitFiles.ts";

const UNIT = "src/orders.unit.test.ts";

const KIT = "Drive the engine through the package's story kit in a story, or, if the code under test is pure,";

ruleStory.it(
	"tests/story-specs accepts a unit test of a pure function with its pure relative imports, JSON fixtures and requirement-free Effects",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			{ content: '{"amounts":[1,2]}', path: "src/test-support/amounts.json" },
			{ content: "export const amounts = [1, 2];", path: "src/test-support/amounts.ts" },
			unitSpec(
				[
					'import { expect, it } from "vitest";',
					'import { Effect } from "effect";',
					'import data from "./test-support/amounts.json" with { type: "json" };',
					'import { amounts } from "./test-support/amounts.ts";',
					'import { total } from "./orders.ts";',
					'it("adds", () => { expect(Effect.runSync(Effect.succeed(total(amounts)))).toEqual(total(data.amounts)); });',
				].join("\n"),
			),
		),
	],
	function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	},
);

for (const declaration of ['import type { Client } from "pg";', 'export type { SqlClient } from "effect/sql/SqlClient";']) {
	ruleStory.it(
		`tests/story-specs ignores the type-only engine import in a unit test: ${declaration}`,
		[repositoryHas(ordersPackage, unitSpec(declaration))],
		function* ({ check }) {
			expect(yield* check(storySpecs)).toEqual([]);
		},
	);
}

for (const [specifier, label, engine] of [
	["node:fs/promises", "node:fs/promises", "the file system"],
	["node:https", "node:https", "the network"],
	["effect/http", "effect/http", "the network"],
	["@effect/platform-node", "@effect/platform-node", "the network"],
	["child_process", "node:child_process", "a process"],
	["node:worker_threads", "node:worker_threads", "a worker"],
	["@effect/sql-pg", "@effect/sql-pg", "a database"],
	["@prisma-next/sql-orm-client", "@prisma-next/sql-orm-client", "a database"],
	["pg", "pg", "a database"],
	["happy-dom", "happy-dom", "the DOM"],
	["@shivaedev/test-story/server/storyKit.ts", "@shivaedev/test-story/server/storyKit.ts", "a story engine"],
] as const) {
	ruleStory.it(
		`tests/story-specs reports a unit test importing ${specifier} as reaching ${engine} and asks to remove the import`,
		[repositoryHas(ordersPackage, unitSpec(`import { engine } from "${specifier}";`))],
		function* ({ check }) {
			const findings = yield* check(storySpecs);

			expect(findings).toEqual([
				{
					file: UNIT,
					line: 1,
					message: `Is a unit test but reaches ${engine} (${label}) through ${UNIT} -> ${label}. A unit test reaches no engine, directly or through what it imports. ${KIT} remove that import from the .unit file.`,
				},
			]);
		},
	);
}

ruleStory.it(
	"tests/story-specs leaves a unit test's import of a package that is no engine alone",
	[repositoryHas(ordersPackage, unitSpec('import { pick } from "lodash";'))],
	function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	},
);

ruleStory.it(
	"tests/story-specs asks to split the module under test when it shares its module with I/O, naming the import chain",
	[
		repositoryHas(
			ordersPackage,
			orders,
			{ content: 'export { total } from "./orders.ts";', path: "src/checkout.ts" },
			unitSpec('import { total } from "./checkout.ts";'),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		expect(findings).toEqual([
			{
				file: UNIT,
				line: 1,
				message: `Is a unit test but reaches the file system (node:fs) through ${UNIT} -> src/checkout.ts -> src/orders.ts -> node:fs. A unit test reaches no engine, directly or through what it imports. ${KIT} split src/checkout.ts: move the pure code under test into its own module that reaches no engine, and test that module in the .unit file.`,
			},
		]);
	},
);

ruleStory.it(
	"tests/story-specs asks a unit test for fixtures that reach no engine when its test-support fixture reads a file",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			{
				content: 'import { readFileSync } from "node:fs";\nexport const amounts = JSON.parse(readFileSync("amounts.json", "utf8"));',
				path: "src/test-support/amounts.ts",
			},
			unitSpec('import { total } from "./orders.ts";\nimport { amounts } from "./test-support/amounts.ts";'),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		expect(findings).toEqual([
			{
				file: UNIT,
				line: 2,
				message: `Is a unit test but reaches the file system (node:fs) through ${UNIT} -> src/test-support/amounts.ts -> node:fs. A unit test reaches no engine, directly or through what it imports. ${KIT} give the .unit file fixtures from a test-support module that reaches no engine instead of src/test-support/amounts.ts.`,
			},
		]);
	},
);

ruleStory.it(
	"tests/story-specs checks a unit test inside test-story itself",
	[
		repositoryHas(
			{ content: '{"name":"@shivaedev/test-story"}', path: "package.json" },
			{ content: 'import { spawn } from "node:child_process";', path: "src/runner.unit.spec.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(storySpecs);

		expect(yield* locations()).toEqual(["src/runner.unit.spec.ts:1"]);
	},
);
