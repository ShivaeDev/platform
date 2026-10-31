import { expect } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { ordersPackage, pureOrders, unitSpec } from "#test/unitFiles.ts";

const UNIT = "src/orders.unit.test.ts";

const KIT = "Drive the engine through the package's story kit in a story, or, if the code under test is pure,";
const WITHOUT_STAND_INS = `${KIT} test it in the .unit file without stand-ins.`;
const WITHOUT_DOM = `A unit test runs without one. ${KIT} test it in the .unit file without the DOM.`;
const REAL_VALUES = "A unit test calls real code with real values and stands nothing in for a collaborator.";
const REQUIREMENT_FREE = "A unit test runs only requirement-free code, such as Effect.runSync on an Effect that needs nothing.";

const GLOBAL_VI = "";

for (const [imports, call, mock] of [
	[GLOBAL_VI, 'vi.mock("./orders.ts");', "vi.mock"],
	[GLOBAL_VI, 'vi.doMock("./orders.ts");', "vi.doMock"],
	[GLOBAL_VI, "vi.hoisted(() => 1);", "vi.hoisted"],
	['import * as v from "vitest";', 'v.vi.spyOn(Math, "random");', "v.vi.spyOn"],
	['import { vi as mocks } from "@effect/vitest";', "mocks.fn();", "mocks.fn"],
	[GLOBAL_VI, "vi.mocked(total);", "vi.mocked"],
	[GLOBAL_VI, "vi.mockObject({});", "vi.mockObject"],
	[GLOBAL_VI, 'vi.importMock("./orders.ts");', "vi.importMock"],
	[GLOBAL_VI, 'vi.importActual("./orders.ts");', "vi.importActual"],
	[GLOBAL_VI, 'vi.stubEnv("TZ", "UTC");', "vi.stubEnv"],
	[GLOBAL_VI, 'vi.stubGlobal("fetch", total);', "vi.stubGlobal"],
	[GLOBAL_VI, "vi.useFakeTimers();", "vi.useFakeTimers"],
	[GLOBAL_VI, "vi.setSystemTime(0);", "vi.setSystemTime"],
] as const) {
	ruleStory.it(
		`tests/story-specs reports a unit test that mocks with ${mock} and asks for real values`,
		[repositoryHas(ordersPackage, pureOrders, unitSpec(`${imports}\n${call}`))],
		function* ({ check }) {
			const findings = yield* check(storySpecs);

			expect(findings).toEqual([{ file: UNIT, line: 2, message: `Is a unit test but mocks with ${mock}. ${REAL_VALUES} ${WITHOUT_STAND_INS}` }]);
		},
	);
}

ruleStory.it(
	"tests/story-specs reports a stand-in once, at its first call, however often a unit test calls it",
	[repositoryHas(ordersPackage, pureOrders, unitSpec('import * as v from "vitest";\nv.vi.spyOn(Math, "random");\nvi.spyOn(Math, "max");'))],
	function* ({ check, locations }) {
		yield* check(storySpecs);

		expect(yield* locations()).toEqual([`${UNIT}:2`]);
	},
);

for (const [imports, call, provider] of [
	['import { Effect } from "effect";', "Effect.runSync(program.pipe(Effect.provide(live)));", "Effect.provide"],
	['import { Effect } from "effect";', "Effect.provideService(Prices, prices);", "Effect.provideService"],
	['import { Layer } from "effect";', "Layer.succeed(Prices, prices);", "Layer.succeed"],
	['import * as Layers from "effect/Layer";', "Layers.empty;", "Layers.empty"],
	['import { succeed } from "effect/Layer";', "succeed(Prices, prices);", "succeed"],
	['import { ManagedRuntime } from "effect";', "ManagedRuntime.make(live);", "ManagedRuntime.make"],
	['import { layer } from "@effect/vitest";', 'layer(live)("orders", () => {});', "layer"],
	['import { it as effect } from "@effect/vitest";', 'effect.layer(live)("orders", () => {});', "effect.layer"],
	['import * as testing from "@effect/vitest";', "testing.layer(live);", "testing.layer"],
] as const) {
	ruleStory.it(
		`tests/story-specs reports a unit test that provides services with ${provider} and asks for requirement-free code`,
		[repositoryHas(ordersPackage, pureOrders, unitSpec(`${imports}\n${call}`))],
		function* ({ check }) {
			const findings = yield* check(storySpecs);

			expect(findings).toEqual([
				{ file: UNIT, line: 2, message: `Is a unit test but provides services with ${provider}. ${REQUIREMENT_FREE} ${WITHOUT_STAND_INS}` },
			]);
		},
	);
}

for (const [lookalike, lines] of [
	["Vitest's mock resets", ["vi.restoreAllMocks(); vi.clearAllMocks(); vi.resetAllMocks.bind(vi);"]],
	["a Layer of a local module", ['import { Layer } from "./layers.ts";', "Layer.succeed(1);"]],
	[
		"requirement-free Effects",
		[
			'import { Effect, Schema } from "effect";',
			"Effect.succeed(1); Effect.runSync(Effect.void); Schema.String; Effect.runSync(Effect.service(Prices));",
		],
	],
	["it.effect of Effect's Vitest", ['import { it } from "@effect/vitest";', 'it.effect("runs", function* () {});']],
] as const) {
	ruleStory.it(
		`tests/story-specs leaves ${lookalike} in a unit test alone`,
		[
			repositoryHas(
				ordersPackage,
				pureOrders,
				{ content: "export const Layer = { succeed: (value: number) => value };", path: "src/layers.ts" },
				unitSpec(lines.join("\n")),
			),
		],
		function* ({ check }) {
			expect(yield* check(storySpecs)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/story-specs reports a unit test that uses the DOM and asks to test without it",
	[repositoryHas(ordersPackage, unitSpec('window.alert("total");'))],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		expect(findings).toEqual([{ file: UNIT, line: 1, message: `Is a unit test but uses the DOM. ${WITHOUT_DOM}` }]);
	},
);

ruleStory.it(
	"tests/story-specs reports a mock inside a test-support fixture a unit test imports, naming the import chain",
	[
		repositoryHas(
			ordersPackage,
			{ content: 'import { vi } from "vitest";\nexport const prices = vi.fn();', path: "src/test-support/prices.ts" },
			unitSpec('import { prices } from "./test-support/prices.ts";'),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		expect(findings).toEqual([
			{
				file: UNIT,
				line: 1,
				message: `Is a unit test but in src/test-support/prices.ts, which it imports through ${UNIT} -> src/test-support/prices.ts, mocks with vi.fn. ${REAL_VALUES} ${WITHOUT_STAND_INS}`,
			},
		]);
	},
);

ruleStory.it(
	"tests/story-specs reports DOM use in a test-support fixture a unit test reaches through a re-export, naming the import chain",
	[
		repositoryHas(
			ordersPackage,
			{ content: "export const shown = () => document.title;", path: "src/test-support/screen.ts" },
			{ content: 'export { shown } from "./screen.ts";', path: "src/test-support/view.ts" },
			unitSpec('import { shown } from "./test-support/view.ts";'),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		expect(findings).toEqual([
			{
				file: UNIT,
				line: 1,
				message: `Is a unit test but in src/test-support/screen.ts, which it imports through ${UNIT} -> src/test-support/view.ts -> src/test-support/screen.ts, uses the DOM. ${WITHOUT_DOM}`,
			},
		]);
	},
);

ruleStory.it(
	"tests/story-specs leaves the Layers of a production module a unit test imports to the import check",
	[
		repositoryHas(
			ordersPackage,
			{ content: 'import { Layer } from "effect";\nexport const live = Layer.empty;\nexport const total = () => 0;', path: "src/orders.ts" },
			unitSpec('import { total } from "./orders.ts";'),
		),
	],
	function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	},
);
