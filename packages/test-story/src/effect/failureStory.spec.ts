import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { onTestFailed } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { hasDough, hasFlourDelivered, newBakery, ovenIsLit, Supplier } from "#test/effect/bakery.ts";

const { effectApp } = makeEffectIt({ layer: Supplier.layer, makeHarness: () => Effect.succeed({}) });

const reported: string[] = [];

function collectFailures(): void {
	onTestFailed(({ task }) => {
		reported.push(...(task.result?.errors ?? []).map((error) => error.message));
	});
}

const INTRO =
	'test-story: this test tells a story over a real bakery. "given" lines are its traits; the other lines were told by verbs and engine steps as they ran, each beside the spec line that caused it when known. ✗ marks where it stopped.';

function footer(test: string): string {
	return `The traits, verbs and engine steps live in the bakery story kit this test imports. Rerun: vitest run src/effect/failureStory.spec.ts -t "${test}"`;
}

effectApp.fails("prints the story with what the kit's inspect shows", function* () {
	collectFailures();
	const { oven } = yield* newBakery(ovenIsLit(), hasDough(1), hasFlourDelivered(1));

	expect((yield* oven.bakesEverything()).loaves, "loaves").toBe(2);
});

effectApp.fails("prints the story when the bakery breaks", function* () {
	collectFailures();
	const { oven } = yield* newBakery(hasDough(1), hasFlourDelivered(1));

	yield* oven.bakesEverything();
});

effectApp("printed each story with its own failure, steps beside the verb that ran them", function* () {
	yield* Effect.void;

	expect(reported).toEqual([
		[
			"loaves: expected 1 to be 2 // Object.is equality",
			"",
			INTRO,
			"  given  the oven is lit                              src/effect/failureStory.spec.ts:26:36",
			"  given  the baker has 1 balls of dough               src/effect/failureStory.spec.ts:26:49",
			"  given  the supplier has delivered 1 sacks of flour  src/effect/failureStory.spec.ts:26:62",
			"         1m a loaf comes out of the oven              src/effect/failureStory.spec.ts:28:22",
			"✗        the test failed after the line above",
			"",
			'The bakery when the test failed: {"dough":0,"flour":0,"loaves":1,"minute":1,"ovenLit":true}',
			"",
			footer("prints the story with what the kit's inspect shows"),
		].join("\n"),
		[
			"the bakery broke after 0 steps: the oven is cold with 1 balls of dough waiting",
			"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this failure shows the setup and steps that led here.",
			"",
			INTRO,
			"  given  the baker has 1 balls of dough               src/effect/failureStory.spec.ts:33:36",
			"  given  the supplier has delivered 1 sacks of flour  src/effect/failureStory.spec.ts:33:49",
			"✗        the test failed after the line above",
			"",
			'The bakery when the test failed: {"dough":1,"flour":1,"loaves":0,"minute":0,"ovenLit":false}',
			"",
			footer("prints the story when the bakery breaks"),
		].join("\n"),
	]);
});
