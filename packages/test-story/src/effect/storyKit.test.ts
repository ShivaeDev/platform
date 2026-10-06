import { expect } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import {
	bakerIsCalledAway,
	hasBowls,
	hasDough,
	hasFlourDelivered,
	hasFlourFromTheMill,
	hasNoBowls,
	hasOatsFromTheMill,
	hasRyeFromTheMill,
	NoBowls,
	newBakery,
	ovenIsLit,
	Supplier,
	traits,
} from "#test/effect/bakery.ts";
import { defectHeadline } from "#test/effect/defectHeadline.ts";

const { effectApp } = makeEffectIt({ layer: Supplier.layer, makeHarness: () => Effect.succeed({}) });

effectApp("fills the pantry after the kitchen, whatever order the test names them in", function* () {
	const { story } = yield* newBakery(hasDough(6), traits(ovenIsLit(), hasBowls(2)), hasFlourDelivered(2));

	expect(story.engine.dough).toBe(6);
	expect(story.engine.flour).toBe(2);
	expect(story.lines).toEqual([
		"the baker has 6 balls of dough",
		"the oven is lit",
		"the bakery has 2 bowls",
		"the supplier has delivered 2 sacks of flour",
	]);
});

effectApp("refuses a trait whose effect fails, as a defect that names the error", function* () {
	const exit = yield* Effect.exit(newBakery(hasFlourDelivered(9)));

	expect(defectHeadline(exit)).toBe(
		'the trait "the supplier has delivered 9 sacks of flour" refused to set up the bakery: SupplierShort: the supplier delivers at most 5 sacks',
	);
});

effectApp("names the refusal of a trait that fails with a plain value", function* () {
	const exit = yield* Effect.exit(newBakery(hasFlourFromTheMill()));

	expect(defectHeadline(exit)).toBe('the trait "the mill has sent flour" refused to set up the bakery: the mill is closed');
});

effectApp("names the refusal of a trait that fails with a plain object by its fields", function* () {
	const exit = yield* Effect.exit(newBakery(hasOatsFromTheMill()));

	expect(defectHeadline(exit)).toBe('the trait "the mill has sent oats" refused to set up the bakery: {"mill":"closed","sacks":0}');
});

effectApp("names the refusal of a trait that fails with a tagged error by its tag and fields", function* () {
	const exit = yield* Effect.exit(newBakery(hasRyeFromTheMill()));

	expect(defectHeadline(exit)).toBe('the trait "the mill has sent rye" refused to set up the bakery: MillClosed {"until":"Monday"}');
});

effectApp("refuses a trait that throws", function* () {
	const exit = yield* Effect.exit(newBakery(hasDough(4)));

	expect(defectHeadline(exit)).toBe('the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3');
});

effectApp("lets an interrupted trait stay interrupted", function* () {
	const exit = yield* Effect.exit(newBakery(bakerIsCalledAway(), hasDough(1)));

	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
});

effectApp("keeps a failing after hook's error in the error channel", function* () {
	expect(yield* Effect.flip(newBakery(hasNoBowls(), hasDough(0)))).toEqual(new NoBowls());
});
