import { expect } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { hasBowls, hasDough, hasFlourDelivered, newBakery, OutOfFlour, ovenIsLit, Supplier } from "#test/effect/bakery.ts";

const { effectApp } = makeEffectIt({ layer: Supplier.layer, makeHarness: () => Effect.succeed({}) });

effectApp("steps until the bakery settles and returns the report", function* () {
	const { log, oven } = yield* newBakery(ovenIsLit(), hasDough(2), hasFlourDelivered(2));

	expect(yield* oven.bakesEverything()).toEqual({ loaves: 2, minutes: 2 });
	expect(log.lines.slice(-2)).toEqual(["1m a loaf comes out of the oven", "2m a loaf comes out of the oven"]);
});

effectApp("dies with the failure the domain names", function* () {
	const { oven } = yield* newBakery(hasDough(2));

	const exit = yield* Effect.exit(oven.bakesEverything());

	expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toEqual(new Error("the oven is cold with 2 balls of dough waiting"));
});

effectApp("keeps a step's typed failure in the error channel", function* () {
	const { oven } = yield* newBakery(ovenIsLit(), hasDough(2), hasFlourDelivered(1));

	expect(yield* Effect.flip(oven.bakesEverything())).toEqual(new OutOfFlour({ minute: 2 }));
});

effectApp("dies at the cap with the diagnosis and the last lines of the story", function* () {
	const { oven } = yield* newBakery(ovenIsLit(), hasBowls(2), hasDough(6), hasFlourDelivered(5));

	const exit = yield* Effect.exit(oven.bakesEverything(2));

	expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toEqual(
		new Error(
			[
				"4 balls of dough still wait after 2 minutes",
				"last lines of the story:",
				"  the oven is lit",
				"  the bakery has 2 bowls",
				"  the baker has 6 balls of dough",
				"  the supplier has delivered 5 sacks of flour",
				"  1m a loaf comes out of the oven",
				"  2m a loaf comes out of the oven",
			].join("\n"),
		),
	);
});
