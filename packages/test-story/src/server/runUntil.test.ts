import { expect } from "@effect/vitest";
import { attempt } from "#test/attempt.ts";
import { bakery, DEFAULT_STEP_BUDGET, hasBowls, hasDough, keepsSourdough, ovenIsLit, ovenIsOverfired, ovenSmokes } from "#test/bakery.ts";
import { mill } from "#test/mill.ts";
import { unattendedMill } from "#test/unattendedMill.ts";

const BUDGET = 4;

const DOUGH_TO_BAKE = 3;

bakery.it("steps the bakery one minute at a time until the dough runs out", [ovenIsLit(), hasDough(DOUGH_TO_BAKE)], function* ({ oven }) {
	expect(oven.minutes()).toBe(0);

	yield* oven.bakesEverything();

	expect(oven.minutes()).toBe(DOUGH_TO_BAKE);
});

bakery.it("checks the condition before the step budget, so a zero budget takes no step when nothing waits", [ovenIsLit()], function* ({ oven }) {
	expect(yield* attempt(oven.bakesEverything(0))).toBe("succeeded");
});

bakery.it("tells each step into the story after the lines before it", [ovenIsLit()], function* ({ baker, oven, story }) {
	baker.kneads(2);

	yield* oven.bakesEverything();

	expect(story.lines).toEqual([
		"the oven is lit",
		"the baker kneads 2 balls of dough",
		"1m a loaf comes out of the oven",
		"2m a loaf comes out of the oven",
	]);
});

bakery.it("dies with what run.failed reports before taking a step in a broken bakery", [hasDough(2)], function* ({ oven }) {
	expect(yield* attempt(oven.bakesEverything())).toBe(
		[
			"died: the bakery broke after 0 steps: the oven is cold with 2 balls of dough waiting",
			"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this",
			"      failure shows the setup and steps that led here.",
		].join("\n"),
	);
});

bakery.it("dies with what run.failed reports even when the condition also holds", [ovenIsLit(), ovenSmokes()], function* ({ oven }) {
	expect(yield* attempt(oven.bakesEverything())).toBe(
		[
			"died: the bakery broke after 0 steps: the oven fills the bakery with smoke",
			"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this",
			"      failure shows the setup and steps that led here.",
		].join("\n"),
	);
});

bakery.it("dies at the step budget with the kit's diagnosis and what to do", [ovenIsLit(), keepsSourdough(), hasDough(1)], function* ({ oven }) {
	expect(yield* attempt(oven.bakesEverything(12))).toBe(
		[
			"died: the bakery ran 12 steps and never reached what runUntil waits for: 1 balls of dough still wait after 12 minutes: the",
			"  sourdough starter never runs out",
			"help: either the bakery never gets there, so check the setup and the engine, or it needs more steps, so pass a larger",
			"      maxSteps to runUntil.",
		].join("\n"),
	);
});

bakery.it("takes no more steps than the budget the call names", [ovenIsLit(), hasBowls(2), hasDough(6)], function* ({ oven }) {
	yield* attempt(oven.bakesEverything(BUDGET));

	expect(oven.loaves()).toBe(BUDGET);
});

bakery.it("takes the kit's step budget when the call names none", [ovenIsLit(), keepsSourdough(), hasDough(1)], function* ({ oven }) {
	yield* attempt(oven.bakesEverything());

	expect(oven.minutes()).toBe(DEFAULT_STEP_BUDGET);
});

bakery.it("keeps a step's typed failure in the error channel", [ovenIsLit(), ovenIsOverfired(), hasDough(2)], function* ({ oven }) {
	expect(yield* attempt(oven.bakesEverything())).toBe('failed with BurntLoaf {"minute":1}');
});

mill.it("dies with what to do when the kit has no run hooks", [], function* ({ miller }) {
	expect(yield* attempt(miller.waitsForWind())).toBe(
		[
			"died: the mill story kit has no run hooks, so runUntil cannot step the mill",
			"help: give the mill story kit run: { maxSteps, step }, where step advances the mill by one step.",
		].join("\n"),
	);
});

unattendedMill.it("steps a kit that has neither a failure nor a diagnosis hook", [], function* ({ miller, story }) {
	yield* miller.waitsForWind(2);

	expect(story.lines).toEqual(["the wind reaches 1", "the wind reaches 2"]);
});

unattendedMill.it("explains an exhausted budget even without a diagnosis hook", [], function* ({ miller }) {
	expect(yield* attempt(miller.waitsForWind(3))).toBe(
		[
			"died: the mill ran 2 steps and never reached what runUntil waits for",
			"help: either the mill never gets there, so check the setup and the engine, or it needs more steps, so pass a larger",
			"      maxSteps to runUntil.",
		].join("\n"),
	);
});
