import { storySpecs } from "#rules/stories/specs.ts";
import { PURE_REPAIR } from "#rules/stories/unitRuntime.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { ordersPackage, unitSpec } from "#test/unitFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const UNIT = "src/orders.unit.test.ts";

for (const [imports, use, clock] of [
	['import { Clock } from "effect";', "yield* Clock.currentTimeMillis;", "Clock"],
	['import { Clock as Time } from "effect";', "yield* Time.Clock;", "Clock"],
	['import * as E from "effect";', "yield* E.Clock.currentTimeMillis;", "Clock.currentTimeMillis"],
	['import * as Time from "effect/Clock";', "Time.make();", "Clock"],
	['import { Clock as Time } from "effect/Clock";', "yield* Time;", "Clock.Clock"],
	['import { currentTimeMillis as now } from "effect/Clock";', "yield* now;", "Clock.currentTimeMillis"],
	['import { TestClock } from "effect";', "TestClock.adjust(1);", "TestClock"],
	['import { TestClock as Time } from "effect";', "Time.setTime(0);", "TestClock"],
	['import * as Time from "effect/TestClock";', "Time.layer;", "TestClock"],
	['import { adjust as advance } from "effect/TestClock";', "advance(1);", "TestClock.adjust"],
	['import "effect/Clock";', "", "Clock"],
	['export * from "effect/TestClock";', "", "TestClock"],
	['const Time = require("effect/Clock");', "", "Clock"],
] as const) {
	const line = imports.includes('* as E from "effect"') ? 2 : 1;
	ruleStory.it(
		`tests/story-specs rejects a unit clock through ${imports}`,
		[repositoryHas(ordersPackage, unitSpec(`${imports}\n${use}`))],
		function* ({ check }) {
			const findings = yield* check(storySpecs);

			yield* assertThat(findings, (actual) =>
				actual.toEqual([{ file: UNIT, line, message: `This \`.unit\` test reaches \`${clock}\` through \`${UNIT}:${line}\`. ${PURE_REPAIR}` }]),
			);
		},
	);
}

for (const content of [
	'import type { Clock, TestClock, Effect } from "effect";\ntype Program = Effect.Effect<void>;',
	'import { type Clock, type TestClock } from "effect";',
	'import type * as Clock from "effect/Clock";',
	'export type { Clock } from "effect";',
	'export { type TestClock } from "effect";',
	"const Clock = { currentTimeMillis: 1 }; Clock.currentTimeMillis;",
	"const TestClock = { adjust: () => 1 }; TestClock.adjust();",
	'// Clock.currentTimeMillis; Effect.runSync(program);\nconst note = "TestClock.adjust(1); Effect.runPromise(program)";',
	'import { Clock } from "./local.ts"; Clock.currentTimeMillis;',
	'import { Effect } from "effect"; function local(Effect: { runSync(): void }) { Effect.runSync(); }',
]) {
	ruleStory.it(
		`tests/story-specs ignores type-only clocks and runtime lookalikes: ${content}`,
		[repositoryHas(ordersPackage, { content: "export const Clock = { currentTimeMillis: 1 };", path: "src/local.ts" }, unitSpec(content))],
		function* ({ check }) {
			yield* assertThat(yield* check(storySpecs), (actual) => actual.toEqual([]));
		},
	);
}
