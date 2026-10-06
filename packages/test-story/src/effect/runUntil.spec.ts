import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { hasBowls, hasDough, hasFlourDelivered, newBakery, OutOfFlour, ovenIsLit, Supplier } from "#test/effect/bakery.ts";
import { defectHeadline } from "#test/effect/defectHeadline.ts";

const { effectApp } = makeEffectIt({ layer: Supplier.layer, makeHarness: () => Effect.succeed({}) });

effectApp("steps until the condition holds and tells each step", function* () {
	const { oven, story } = yield* newBakery(ovenIsLit(), hasDough(2), hasFlourDelivered(2));

	expect(yield* oven.bakesEverything()).toEqual({ loaves: 2, minutes: 2 });
	expect(story.lines.slice(-2)).toEqual(["1m a loaf comes out of the oven", "2m a loaf comes out of the oven"]);
});

effectApp("dies with what the failed hook reports", function* () {
	const { oven } = yield* newBakery(hasDough(2));

	expect(defectHeadline(yield* Effect.exit(oven.bakesEverything()))).toBe(
		"the bakery broke after 0 steps: the oven is cold with 2 balls of dough waiting",
	);
});

effectApp("keeps a step's typed failure in the error channel", function* () {
	const { oven } = yield* newBakery(ovenIsLit(), hasDough(2), hasFlourDelivered(1));

	expect(yield* Effect.flip(oven.bakesEverything())).toEqual(new OutOfFlour({ minute: 2 }));
});

effectApp("dies after the step budget with the diagnosis", function* () {
	const { oven } = yield* newBakery(ovenIsLit(), hasBowls(2), hasDough(6), hasFlourDelivered(5));

	expect(defectHeadline(yield* Effect.exit(oven.bakesEverything(2)))).toBe(
		"the bakery ran 2 steps and never reached what runUntil waits for: 4 balls of dough still wait after 2 minutes",
	);
});
