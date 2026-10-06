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
	NoBowls,
	newBakery,
	ovenIsLit,
	Supplier,
	traits,
} from "#test/effect/bakery.ts";

const { effectApp } = makeEffectIt({ layer: Supplier.layer, makeHarness: () => Effect.succeed({}) });

effectApp("fills the pantry after the kitchen, whatever order the test names them in", function* () {
	const { bakery, log } = yield* newBakery(hasDough(6), traits(ovenIsLit(), hasBowls(2)), hasFlourDelivered(2));

	expect(bakery.dough).toBe(6);
	expect(bakery.flour).toBe(2);
	expect(log.lines).toEqual([
		"the baker has 6 balls of dough",
		"the oven is lit",
		"the bakery has 2 bowls",
		"the supplier has delivered 2 sacks of flour",
	]);
});

effectApp("refuses a trait whose effect fails, as a defect", function* () {
	const exit = yield* Effect.exit(newBakery(hasFlourDelivered(9)));

	expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toEqual(
		new Error('trait "the supplier has delivered 9 sacks of flour" refused: the supplier delivers at most 5 sacks'),
	);
	expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(false);
});

effectApp("names the refusal of a trait that fails with a plain value", function* () {
	const exit = yield* Effect.exit(newBakery(hasFlourFromTheMill()));

	expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toEqual(new Error('trait "the mill has sent flour" refused: the mill is closed'));
});

effectApp("refuses a trait whose effect dies", function* () {
	const exit = yield* Effect.exit(newBakery(hasDough(4)));

	expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toEqual(
		new Error('trait "the baker has 4 balls of dough" refused: the bowls hold only 3'),
	);
});

effectApp("lets an interrupted trait stay interrupted", function* () {
	const exit = yield* Effect.exit(newBakery(bakerIsCalledAway(), hasDough(1)));

	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
});

effectApp("keeps a failing after hook's error in the error channel", function* () {
	expect(yield* Effect.flip(newBakery(hasNoBowls(), hasDough(0)))).toEqual(new NoBowls());
});
