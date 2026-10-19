import { afterEach, expect, it } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { findingsIn } from "#test/imports.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";
import { headlines, ordersPackage, pureOrders, unitSpec } from "#test/unitFiles.ts";

afterEach(removeSeededTrees);

const KIT = "Drive the engine through the package's story kit in a story, or, if the code under test is pure,";

it("rejects every Vitest mock and stub once, through the global, a named, a renamed and a namespace vi", async () => {
	const root = seedTree([
		ordersPackage,
		pureOrders,
		unitSpec(
			[
				'import * as v from "vitest";',
				'import { vi as mocks } from "@effect/vitest";',
				'vi.mock("./orders.ts"); vi.doMock("./orders.ts"); vi.hoisted(() => 1);',
				'v.vi.spyOn(Math, "random"); vi.spyOn(Math, "max");',
				"const total = mocks.fn().mockReturnValue(3); vi.mocked(total); vi.mockObject({});",
				'await vi.importMock("./orders.ts"); await vi.importActual("./orders.ts");',
				'vi.stubEnv("TZ", "UTC"); vi.stubGlobal("fetch", total);',
				"vi.useFakeTimers(); vi.setSystemTime(0);",
			].join("\n"),
		),
	]);
	const findings = await findingsIn(storySpecs, undefined, root);
	expect(headlines(findings)).toEqual(
		[
			[3, "vi.mock"],
			[3, "vi.doMock"],
			[3, "vi.hoisted"],
			[4, "v.vi.spyOn"],
			[5, "mocks.fn"],
			[5, "vi.mocked"],
			[5, "vi.mockObject"],
			[6, "vi.importMock"],
			[6, "vi.importActual"],
			[7, "vi.stubEnv"],
			[7, "vi.stubGlobal"],
			[8, "vi.useFakeTimers"],
			[8, "vi.setSystemTime"],
		].map(([line, what]) => [line, `Is a unit test but mocks with ${what}`]),
	);
	expect(findings.every((finding) => finding.message.includes(`${KIT} test it in the .unit file without stand-ins.`))).toBe(true);
});

it("rejects services provided through Effect, Layer, ManagedRuntime and Effect's Vitest layers, including module imports", async () => {
	const root = seedTree([
		ordersPackage,
		pureOrders,
		unitSpec(
			[
				'import { Effect, Layer, ManagedRuntime } from "effect";',
				'import * as Context from "effect/Layer";',
				'import { succeed } from "effect/Layer";',
				'import { it as effect, layer } from "@effect/vitest";',
				'import * as testing from "@effect/vitest";',
				"Effect.runSync(program.pipe(Effect.provide(live), Effect.provideService(Prices, prices)));",
				"Layer.succeed(Prices, prices); Context.empty; succeed(Prices, prices);",
				"ManagedRuntime.make(live);",
				'layer(live)("orders", () => {}); effect.layer(live)("orders", () => {}); testing.layer(live);',
			].join("\n"),
		),
	]);
	const findings = await findingsIn(storySpecs, undefined, root);
	expect(headlines(findings)).toEqual(
		[
			[6, "Effect.provide"],
			[6, "Effect.provideService"],
			[7, "Layer.succeed"],
			[7, "Context.empty"],
			[8, "ManagedRuntime.make"],
			[9, "layer"],
			[9, "effect.layer"],
		].map(([line, what]) => [line, `Is a unit test but provides services with ${what}`]),
	);
	expect(findings[0]?.message).toContain(
		`A unit test runs only requirement-free code, such as Effect.runSync on an Effect that needs nothing. ${KIT}`,
	);
});

it("leaves lookalikes alone: other Vitest helpers, other modules, unbound names and requirement-free Effects", async () => {
	const root = seedTree([
		ordersPackage,
		pureOrders,
		unitSpec(
			[
				'import { Effect, Schema } from "effect";',
				'import { Layer } from "./layers.ts";',
				'import { it } from "@effect/vitest";',
				'import "./setup.ts";',
				"vi.restoreAllMocks(); vi.clearAllMocks(); vi.resetAllMocks.bind(vi);",
				"Layer.succeed(1); Effect.succeed(1); Effect.runSync(Effect.void); Schema.String;",
				'ManagedRuntime.make(live); unknown.vi.mock(); layered(); it.effect("runs", function* () {});',
				"new Effect.Tag(); Effect.runSync(Effect.service(Prices));",
				'const document = { title: "orders" }; document.title;',
				"function read(document: { title: string }) { return document.title; }",
				'{ const { document } = { document: { title: "orders" } }; document.title; }',
			].join("\n"),
		),
		{ content: "export const Layer = { succeed: (value: number) => value };", path: "src/layers.ts" },
		{ content: "export {};", path: "src/setup.ts" },
	]);
	expect(headlines(await findingsIn(storySpecs, undefined, root))).toEqual([]);
});

it("rejects DOM use in the unit file and stand-ins or DOM use in the test-support fixtures it imports", async () => {
	const root = seedTree([
		ordersPackage,
		pureOrders,
		{ content: 'import { vi } from "vitest";\nexport const prices = vi.fn();', path: "src/test-support/prices.ts" },
		{ content: "export const shown = () => document.title;", path: "src/test-support/screen.ts" },
		{ content: 'export { shown } from "./screen.ts";', path: "src/test-support/view.ts" },
		unitSpec(
			['import { prices } from "./test-support/prices.ts";', 'import { shown } from "./test-support/view.ts";', 'window.alert("total");'].join("\n"),
		),
	]);
	const findings = await findingsIn(storySpecs, undefined, root);
	expect(headlines(findings)).toEqual([
		[1, "Is a unit test but uses the DOM"],
		[
			1,
			"Is a unit test but in src/test-support/prices.ts, which it imports through src/orders.unit.test.ts -> src/test-support/prices.ts, mocks with vi.fn",
		],
		[
			2,
			"Is a unit test but in src/test-support/screen.ts, which it imports through src/orders.unit.test.ts -> src/test-support/view.ts -> src/test-support/screen.ts, uses the DOM",
		],
	]);
	expect(findings[0]?.message).toContain(`A unit test runs without one. ${KIT} test it in the .unit file without the DOM.`);
});

it("leaves the production modules a unit test imports to the import check", async () => {
	const root = seedTree([
		ordersPackage,
		{ content: 'import { Layer } from "effect";\nexport const live = Layer.empty;\nexport const total = () => 0;', path: "src/orders.ts" },
		unitSpec('import { total } from "./orders.ts";'),
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});
