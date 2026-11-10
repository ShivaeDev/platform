import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { ordersPackage, unitSpec } from "#test/unitFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { PURE_REPAIR } from "#units/runtime.ts";

const UNIT = "src/orders.unit.test.ts";

for (const runner of [
	"runSync",
	"runSyncWith",
	"runSyncExit",
	"runSyncExitWith",
	"runPromise",
	"runPromiseWith",
	"runPromiseExit",
	"runPromiseExitWith",
	"runFork",
	"runForkWith",
	"runCallback",
	"runCallbackWith",
]) {
	for (const call of [`Effect.${runner}(program);`, `Effect["${runner}"](program);`, `const run = Effect.${runner}; run(program);`]) {
		ruleStory.it(
			`tests/story-specs rejects a unit runner call: ${call}`,
			[repositoryHas(ordersPackage, unitSpec(`import { Effect } from "effect";\n${call}`))],
			function* ({ check }) {
				const findings = yield* check(storySpecs);

				yield* assertThat(findings, (actual) =>
					actual.toEqual([
						{ file: UNIT, line: 2, message: `This \`.unit\` test reaches \`Effect.${runner}\` through \`${UNIT}:2\`. ${PURE_REPAIR}` },
					]),
				);
			},
		);
	}
}

for (const [content, runner, line] of [
	['import { Effect as E } from "effect";\nE.runSync(program);', "Effect.runSync", 2],
	['import * as E from "effect";\nE.Effect.runPromise(program);', "Effect.runPromise", 2],
	['import * as E from "effect/Effect";\nE.runSyncExit(program);', "Effect.runSyncExit", 2],
	['import { runPromise as execute } from "effect/Effect";\nexecute(program);', "Effect.runPromise", 1],
	['import { Effect } from "effect";\nconst { runFork: start } = Effect; start(program);', "Effect.runFork", 2],
	['import { it as test } from "@effect/vitest";\ntest.effect("works", () => program);', "it.effect", 2],
	['import { Effect } from "effect";\nEffect.runSync(Effect.succeed(1)); Effect.runPromise(Effect.void);', "Effect.runSync", 2],
	['const E = await import("effect");\nE.Effect.runPromise(program);', "Effect.runPromise", 2],
	['const { runSync: run } = require("effect/Effect");\nrun(program);', "Effect.runSync", 1],
	['import { Effect } from "effect";\nconst method = "runPromise"; Effect[method](program);', "Effect.runPromise", 2],
	['import { Effect } from "effect";\nprograms.map(Effect.runPromise);', "Effect.runPromise", 2],
	['import { Effect } from "effect";\nconst choose = () => Effect.runSync; choose()(program);', "Effect.runSync", 2],
	['import E = require("effect/Effect");\nE.runSync(program);', "Effect.runSync", 2],
] as const) {
	ruleStory.it(
		`tests/story-specs reports the first runtime use once: ${content}`,
		[repositoryHas(ordersPackage, unitSpec(content))],
		function* ({ check }) {
			const findings = yield* check(storySpecs);

			yield* assertThat(findings, (actual) =>
				actual.toEqual([{ file: UNIT, line, message: `This \`.unit\` test reaches \`${runner}\` through \`${UNIT}:${line}\`. ${PURE_REPAIR}` }]),
			);
		},
	);
}
