import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { orders, ordersPackage, pureOrders, unitSpec } from "#quality/test-support/unitFiles.ts";
import { storySpecs } from "#quality-internal/rules/stories/specs.ts";
import { testsColocated } from "#quality-internal/rules/test-names/colocated.ts";
import { testsFollow } from "#quality-internal/rules/test-names/follow.ts";

const KIT = "Drive the engine through the package's story kit";

ruleKit.it(
	"a unit test of a pure function passes without a story kit",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			unitSpec('import { expect, it } from "vitest";\nimport { total } from "./orders.ts";\nit("adds", () => { expect(total([1, 2])).toBe(3); });'),
		),
	],
	function* ({ checks }) {
		expect(yield* checks(storySpecs)).toEqual([]);
	},
);

ruleKit.it(
	"a unit test may run a requirement-free Effect and import an engine's types",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			unitSpec(
				'import type { Client } from "pg";\nimport { Effect } from "effect";\nimport { total } from "./orders.ts";\nit("adds", () => { expect(Effect.runSync(Effect.succeed(total([1])))).toBe(1); });',
			),
		),
	],
	function* ({ checks }) {
		expect(yield* checks(storySpecs)).toEqual([]);
	},
);

ruleKit.it(
	"a plain test outside a .unit file still fails and names both honest forms",
	[repositoryHas(ordersPackage, pureOrders, { content: 'import { it } from "vitest";\nit("adds", () => {});', path: "src/orders.test.ts" })],
	function* ({ checks }) {
		const [finding, ...rest] = yield* checks(storySpecs);
		expect(rest).toEqual([]);
		expect(finding?.file).toBe("src/orders.test.ts");
		expect(finding?.message).toContain(KIT);
		expect(finding?.message).toContain("move the test to orders.unit.test.ts");
	},
);

ruleKit.it(
	"a unit test that imports a database client or another engine fails and names each import",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			unitSpec(
				[
					'import { Client } from "pg";',
					'import { HttpClient } from "effect/http";',
					'import { Window } from "happy-dom";',
					'import { spawn } from "node:child_process";',
					'import { Worker } from "node:worker_threads";',
					'it("connects", () => { new Client(); });',
				].join("\n"),
			),
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(storySpecs);
		expect(findings.map((finding) => [finding.line, finding.message.slice(0, finding.message.indexOf(". "))])).toEqual([
			[1, "Is a unit test but reaches a database (pg) through src/orders.unit.test.ts -> pg"],
			[2, "Is a unit test but reaches the network (effect/http) through src/orders.unit.test.ts -> effect/http"],
			[3, "Is a unit test but reaches the DOM (happy-dom) through src/orders.unit.test.ts -> happy-dom"],
			[4, "Is a unit test but reaches a process (node:child_process) through src/orders.unit.test.ts -> node:child_process"],
			[5, "Is a unit test but reaches a worker (node:worker_threads) through src/orders.unit.test.ts -> node:worker_threads"],
		]);
		expect(findings.every((finding) => finding.message.includes(KIT) && finding.message.includes("remove that import from the .unit file"))).toBe(
			true,
		);
	},
);

ruleKit.it(
	"a unit test that reaches node:fs through the module under test is told to split that module",
	[repositoryHas(ordersPackage, orders, unitSpec('import { total } from "./orders.ts";\nit("adds", () => { expect(total([1])).toBe(1); });'))],
	function* ({ checks }) {
		const findings = yield* checks(storySpecs);
		expect(findings.map((finding) => finding.message)).toEqual([
			expect.stringContaining("reaches the file system (node:fs) through src/orders.unit.test.ts -> src/orders.ts -> node:fs."),
		]);
		expect(findings[0]?.message).toContain(KIT);
		expect(findings[0]?.message).toContain("split src/orders.ts: move the pure code under test into its own module");
	},
);

ruleKit.it(
	"a unit test whose test-support fixture reaches an engine fails through that fixture",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			{
				content: 'import { readFileSync } from "node:fs";\nexport const amounts = JSON.parse(readFileSync("amounts.json", "utf8"));',
				path: "src/test-support/amounts.ts",
			},
			unitSpec('import { amounts } from "./test-support/amounts.ts";\nimport { total } from "./orders.ts";\nit("adds", () => { total(amounts); });'),
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(storySpecs);
		expect(findings.map((finding) => finding.message)).toEqual([
			expect.stringContaining("through src/orders.unit.test.ts -> src/test-support/amounts.ts -> node:fs."),
		]);
		expect(findings[0]?.message).toContain("fixtures from a test-support module that reaches no engine");
	},
);

ruleKit.it(
	"a unit test that provides a Layer fails, whether through Effect.provide, Layer or it.layer",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			unitSpec(
				[
					'import { Effect, Layer } from "effect";',
					'import { it as effect, layer } from "@effect/vitest";',
					"const Live = Layer.succeed(Prices, prices);",
					'it("prices", () => Effect.runSync(program.pipe(Effect.provide(Live))));',
					'layer(Live)("orders", (it) => {});',
					'effect.layer(Live)("orders", (it) => {});',
				].join("\n"),
			),
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(storySpecs);
		expect(findings).toEqual(
			[
				[3, "Layer.succeed"],
				[4, "Effect.provide"],
				[5, "layer"],
				[6, "effect.layer"],
			].map(([line, what]) => ({
				file: "src/orders.unit.test.ts",
				line,
				message: expect.stringContaining(`Is a unit test but provides services with ${what}.`),
			})),
		);
		expect(findings.every((finding) => finding.message.includes(KIT))).toBe(true);
	},
);

ruleKit.it(
	"a unit test that mocks fails for vi.mock and vi.spyOn, including through a namespace import",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			unitSpec(
				[
					'import * as v from "vitest";',
					'vi.mock("./orders.ts");',
					'it("spies", () => { v.vi.spyOn(console, "log"); vi.spyOn(Math, "random"); });',
				].join("\n"),
			),
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(storySpecs);
		expect(findings).toEqual(
			[
				[2, "vi.mock"],
				[3, "v.vi.spyOn"],
			].map(([line, what]) => ({
				file: "src/orders.unit.test.ts",
				line,
				message: expect.stringContaining(`Is a unit test but mocks with ${what}.`),
			})),
		);
		expect(findings.every((finding) => finding.message.includes(KIT))).toBe(true);
	},
);

ruleKit.it(
	"a unit test fails for stubs, fake timers, runtimes, the DOM, a story runner and a test-support fixture that mocks",
	[
		repositoryHas(
			ordersPackage,
			pureOrders,
			{ content: 'import { vi } from "vitest";\nexport const prices = vi.fn();', path: "src/test-support/prices.ts" },
			unitSpec(
				[
					'import { it as effect } from "@effect/vitest";',
					'import { ManagedRuntime } from "effect";',
					'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";',
					'import { prices } from "./test-support/prices.ts";',
					'vi.stubEnv("TZ", "UTC"); vi.stubGlobal("fetch", prices); vi.useFakeTimers();',
					"ManagedRuntime.make(live);",
					'document.body.append("total");',
					'effect.effect("totals", function* () {});',
				].join("\n"),
			),
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(storySpecs);
		expect(findings.map((finding) => [finding.line, finding.message.slice(0, finding.message.indexOf(". "))])).toEqual([
			[
				3,
				"Is a unit test but reaches a story engine (@shivaedev/test-story/server/storyKit.ts) through src/orders.unit.test.ts -> @shivaedev/test-story/server/storyKit.ts",
			],
			[5, "Is a unit test but mocks with vi.stubEnv"],
			[5, "Is a unit test but mocks with vi.stubGlobal"],
			[5, "Is a unit test but mocks with vi.useFakeTimers"],
			[6, "Is a unit test but provides services with ManagedRuntime.make"],
			[1, "Is a unit test but uses the DOM"],
			[
				4,
				"Is a unit test but in src/test-support/prices.ts, which it imports through src/orders.unit.test.ts -> src/test-support/prices.ts, mocks with vi.fn",
			],
		]);
	},
);

ruleKit.it(
	"a .unit test or spec follows its file, a unit DOM test is rejected and a mirrored unit test keeps its modifier",
	[
		repositoryHas(
			pureOrders,
			unitSpec('it("adds", () => {});'),
			{ content: 'it("orders", () => {});', path: "src/checkoutFlow.unit.spec.ts" },
			{ content: 'it("renders", () => {});', path: "src/orders.unit.dom.test.ts" },
			{ content: 'it("adds", () => {});', path: "src/tests/orders.unit.test.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(testsFollow)).toEqual([
			{
				file: "src/orders.unit.dom.test.ts",
				message: expect.stringContaining("is both a unit and a DOM test, but a unit test runs without the DOM."),
			},
			{ file: "src/tests/orders.unit.test.ts", message: expect.stringContaining("orders.unit.test.ts sits beside orders.ts") },
		]);
		expect(yield* checks(testsColocated)).toEqual([
			{ file: "src/tests/orders.unit.test.ts", message: expect.stringContaining("as orders.unit.test.ts beside orders.ts") },
		]);
	},
);
