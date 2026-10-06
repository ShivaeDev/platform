import { describe, expect, it } from "vitest";
import { hasBowls, hasDough, keepsSourdough, newBakery, ovenIsLit, ovenSmokes } from "#test/bakery.ts";

describe("a story runs its bakery until the test's condition holds, or says why not", () => {
	it("steps until the condition holds", () => {
		const { oven } = newBakery(ovenIsLit(), hasDough(3));

		expect(oven.bakesEverything()).toEqual({ loaves: 3, minutes: 3 });
	});

	it("takes no step when the condition already holds", () => {
		const { oven } = newBakery(ovenIsLit());

		expect(oven.bakesEverything(0)).toEqual({ loaves: 0, minutes: 0 });
	});

	it("tells each step into the story", () => {
		const { baker, oven, story } = newBakery(ovenIsLit());

		baker.kneads(2);
		oven.bakesEverything();

		expect(story.lines).toEqual([
			"the oven is lit",
			"the baker kneads 2 balls of dough",
			"1m a loaf comes out of the oven",
			"2m a loaf comes out of the oven",
		]);
	});

	it("throws what the failed hook reports instead of stepping on", () => {
		const { oven, story } = newBakery(hasDough(2));

		expect(() => oven.bakesEverything()).toThrow(
			[
				"the bakery broke after 0 steps: the oven is cold with 2 balls of dough waiting",
				"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this failure shows the setup and steps that led here.",
			].join("\n"),
		);
		expect(story.engine.minute).toBe(0);
	});

	it("throws the failure even when the condition also holds", () => {
		const { oven } = newBakery(ovenIsLit(), ovenSmokes());

		expect(() => oven.bakesEverything()).toThrow("the bakery broke after 0 steps: the oven fills the bakery with smoke");
	});

	it("stops after the step budget with the diagnosis and what to do", () => {
		const { oven } = newBakery(ovenIsLit(), keepsSourdough(), hasDough(1));

		expect(() => oven.bakesEverything(12)).toThrow(
			[
				"the bakery ran 12 steps and never reached what runUntil waits for: 1 balls of dough still wait after 12 minutes: the sourdough starter never runs out",
				"help: either the bakery never gets there, so check the setup and the engine, or it needs more steps, so pass a larger maxSteps to runUntil.",
			].join("\n"),
		);
	});

	it("takes no more steps than the budget allows", () => {
		const { oven, story } = newBakery(ovenIsLit(), hasBowls(2), hasDough(6));

		expect(() => oven.bakesEverything(4)).toThrow("the bakery ran 4 steps");
		expect(story.engine.loaves).toBe(4);
	});

	it("uses the kit's step budget when the call names none", () => {
		const { oven, story } = newBakery(ovenIsLit(), keepsSourdough(), hasDough(1));

		expect(() => oven.bakesEverything()).toThrow("the bakery ran 60 steps");
		expect(story.engine.minute).toBe(60);
	});
});
