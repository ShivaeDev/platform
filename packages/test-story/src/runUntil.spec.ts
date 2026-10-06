import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { BurntLoaf, bakery, hasBowls, hasDough, keepsSourdough, ovenIsLit, ovenIsOverfired, ovenSmokes } from "#test/bakery.ts";
import { defectMessage } from "#test/defectMessage.ts";
import { mill } from "#test/mill.ts";

bakery.it("steps until the condition holds", [ovenIsLit(), hasDough(3)], function* ({ oven }) {
	expect(yield* oven.bakesEverything()).toEqual({ loaves: 3, minutes: 3 });
});

bakery.it("takes no step when the condition already holds", [ovenIsLit()], function* ({ oven }) {
	expect(yield* oven.bakesEverything(0)).toEqual({ loaves: 0, minutes: 0 });
});

bakery.it("tells each step into the story", [ovenIsLit()], function* ({ baker, oven, story }) {
	baker.kneads(2);
	yield* oven.bakesEverything();

	expect(story.lines).toEqual([
		"the oven is lit",
		"the baker kneads 2 balls of dough",
		"1m a loaf comes out of the oven",
		"2m a loaf comes out of the oven",
	]);
});

bakery.it("dies with what the failed hook reports instead of stepping on", [hasDough(2)], function* ({ oven, story }) {
	expect(defectMessage(yield* Effect.exit(oven.bakesEverything()))).toBe(
		[
			"the bakery broke after 0 steps: the oven is cold with 2 balls of dough waiting",
			"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this failure shows the setup and steps that led here.",
		].join("\n"),
	);
	expect(story.engine.minute).toBe(0);
});

bakery.it("dies with the failure even when the condition also holds", [ovenIsLit(), ovenSmokes()], function* ({ oven }) {
	expect(defectMessage(yield* Effect.exit(oven.bakesEverything()))).toMatch(
		/^the bakery broke after 0 steps: the oven fills the bakery with smoke\n/u,
	);
});

bakery.it("dies after the step budget with the diagnosis and what to do", [ovenIsLit(), keepsSourdough(), hasDough(1)], function* ({ oven }) {
	expect(defectMessage(yield* Effect.exit(oven.bakesEverything(12)))).toBe(
		[
			"the bakery ran 12 steps and never reached what runUntil waits for: 1 balls of dough still wait after 12 minutes: the sourdough starter never runs out",
			"help: either the bakery never gets there, so check the setup and the engine, or it needs more steps, so pass a larger maxSteps to runUntil.",
		].join("\n"),
	);
});

bakery.it("takes no more steps than the budget allows", [ovenIsLit(), hasBowls(2), hasDough(6)], function* ({ oven, story }) {
	expect(defectMessage(yield* Effect.exit(oven.bakesEverything(4)))).toMatch(/^the bakery ran 4 steps/u);
	expect(story.engine.loaves).toBe(4);
});

bakery.it("uses the kit's step budget when the call names none", [ovenIsLit(), keepsSourdough(), hasDough(1)], function* ({ oven, story }) {
	expect(defectMessage(yield* Effect.exit(oven.bakesEverything()))).toMatch(/^the bakery ran 60 steps/u);
	expect(story.engine.minute).toBe(60);
});

bakery.it("keeps a step's typed failure in the error channel", [ovenIsLit(), ovenIsOverfired(), hasDough(2)], function* ({ oven }) {
	expect(yield* Effect.flip(oven.bakesEverything())).toEqual(new BurntLoaf({ minute: 1 }));
});

mill.it("dies with what to do when the kit has no run hooks", [], function* ({ miller }) {
	expect(defectMessage(yield* Effect.exit(miller.waitsForWind()))).toBe(
		[
			"the mill story kit has no run hooks, so runUntil cannot step the mill",
			"help: give the mill story kit run: { maxSteps, step }, where step advances the mill by one step.",
		].join("\n"),
	);
});
