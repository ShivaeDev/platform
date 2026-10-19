import { afterEach, expect, it } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { findingsIn } from "#test/imports.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";
import { headlines, orders, ordersPackage, pureOrders, unitSpec } from "#test/unitFiles.ts";

afterEach(removeSeededTrees);

const KIT = "Drive the engine through the package's story kit in a story, or, if the code under test is pure,";

it("passes a unit test of a pure function, its relative imports, JSON fixtures and requirement-free Effects", async () => {
	const root = seedTree([
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
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("ignores type-only imports of an engine, whether the clause or the declaration is type-only", async () => {
	const root = seedTree([
		ordersPackage,
		pureOrders,
		unitSpec('import type { Client } from "pg";\nexport type { SqlClient } from "effect/sql/SqlClient";\nimport { type Pool } from "pg";'),
	]);
	expect(headlines(await findingsIn(storySpecs, undefined, root))).toEqual([
		[3, "Is a unit test but reaches a database (pg) through src/orders.unit.test.ts -> pg"],
	]);
});

it("names each engine kind a unit test imports directly and asks to remove the import", async () => {
	const root = seedTree([
		ordersPackage,
		unitSpec(
			[
				'import { readFileSync } from "node:fs/promises";',
				'import { request } from "node:https";',
				'import { HttpClient } from "effect/http";',
				'import { NodeServices } from "@effect/platform-node";',
				'import { spawn } from "child_process";',
				'import { Worker } from "node:worker_threads";',
				'import { PgClient } from "@effect/sql-pg";',
				'import { PrismaClient } from "@prisma-next/sql-orm-client";',
				'import { render } from "@testing-library/react";',
				'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";',
				'import { Window } from "happy-dom";',
			].join("\n"),
		),
	]);
	const findings = await findingsIn(storySpecs, undefined, root);
	expect(headlines(findings)).toEqual([
		[1, "Is a unit test but reaches the file system (node:fs/promises) through src/orders.unit.test.ts -> node:fs/promises"],
		[2, "Is a unit test but reaches the network (node:https) through src/orders.unit.test.ts -> node:https"],
		[3, "Is a unit test but reaches the network (effect/http) through src/orders.unit.test.ts -> effect/http"],
		[4, "Is a unit test but reaches the network (@effect/platform-node) through src/orders.unit.test.ts -> @effect/platform-node"],
		[5, "Is a unit test but reaches a process (node:child_process) through src/orders.unit.test.ts -> node:child_process"],
		[6, "Is a unit test but reaches a worker (node:worker_threads) through src/orders.unit.test.ts -> node:worker_threads"],
		[7, "Is a unit test but reaches a database (@effect/sql-pg) through src/orders.unit.test.ts -> @effect/sql-pg"],
		[8, "Is a unit test but reaches a database (@prisma-next/sql-orm-client) through src/orders.unit.test.ts -> @prisma-next/sql-orm-client"],
		[9, "Is a unit test but reaches the DOM (@testing-library/react) through src/orders.unit.test.ts -> @testing-library/react"],
		[
			10,
			"Is a unit test but reaches a story engine (@shivaedev/test-story/server/storyKit.ts) through src/orders.unit.test.ts -> @shivaedev/test-story/server/storyKit.ts",
		],
		[11, "Is a unit test but reaches the DOM (happy-dom) through src/orders.unit.test.ts -> happy-dom"],
		[1, "Is a unit test but uses the DOM"],
	]);
	expect(findings.slice(0, -1).every((finding) => finding.message.includes(`${KIT} remove that import from the .unit file.`))).toBe(true);
});

it("counts an unresolved bare import as the package it names and leaves an unknown package alone", async () => {
	const root = seedTree([ordersPackage, unitSpec('import pg from "pg";\nimport { pick } from "lodash";\nconst pool = await import("postgres");')]);
	expect(headlines(await findingsIn(storySpecs, undefined, root))).toEqual([
		[1, "Is a unit test but reaches a database (pg) through src/orders.unit.test.ts -> pg"],
		[3, "Is a unit test but reaches a database (postgres) through src/orders.unit.test.ts -> postgres"],
	]);
});

it("asks to split the module under test when it shares its module with I/O, naming the import chain", async () => {
	const root = seedTree([
		ordersPackage,
		orders,
		{ content: 'export { total } from "./orders.ts";', path: "src/checkout.ts" },
		unitSpec('import { total } from "./checkout.ts";'),
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([
		{
			file: "src/orders.unit.test.ts",
			line: 1,
			message: `Is a unit test but reaches the file system (node:fs) through src/orders.unit.test.ts -> src/checkout.ts -> src/orders.ts -> node:fs. A unit test reaches no engine, directly or through what it imports. ${KIT} split src/checkout.ts: move the pure code under test into its own module that reaches no engine, and test that module in the .unit file.`,
		},
	]);
});

it("rejects a test-support fixture that reaches an engine and asks for one that reaches none", async () => {
	const root = seedTree([
		ordersPackage,
		pureOrders,
		{
			content: 'import { readFileSync } from "node:fs";\nexport const amounts = JSON.parse(readFileSync("amounts.json", "utf8"));',
			path: "src/test-support/amounts.ts",
		},
		unitSpec('import { total } from "./orders.ts";\nimport { amounts } from "./test-support/amounts.ts";'),
	]);
	const [finding, ...rest] = await findingsIn(storySpecs, undefined, root);
	expect(rest).toEqual([]);
	expect(finding).toEqual({
		file: "src/orders.unit.test.ts",
		line: 2,
		message: expect.stringContaining(
			`through src/orders.unit.test.ts -> src/test-support/amounts.ts -> node:fs. A unit test reaches no engine, directly or through what it imports. ${KIT} give the .unit file fixtures from a test-support module that reaches no engine instead of src/test-support/amounts.ts.`,
		),
	});
});

it("checks a .unit spec and a unit test in a test-story prerequisite package", async () => {
	const root = seedTree([
		{ content: '{"name":"@shivaedev/test-story"}', path: "package.json" },
		{ content: 'import { spawn } from "node:child_process";', path: "src/runner.unit.spec.ts" },
		{ content: 'import { it } from "vitest";\nit("runs", () => {});', path: "src/runner.spec.ts" },
	]);
	expect((await findingsIn(storySpecs, undefined, root)).map((finding) => finding.file)).toEqual(["src/runner.unit.spec.ts"]);
});

it("names both honest forms for a plain test outside a .unit file, keeping its kind and extension", async () => {
	const root = seedTree([ordersPackage, { content: 'import { it } from "vitest";\nit("adds", () => {});', path: "src/checkoutFlow.dom.spec.tsx" }]);
	const [finding] = await findingsIn(storySpecs, undefined, root);
	expect(finding?.message).toContain("Drive the engine through the package's story kit: build it with storyKit");
	expect(finding?.message).toContain(
		"If the code under test is pure, move the test to checkoutFlow.unit.spec.tsx, which reaches no engine and mocks nothing.",
	);
});
