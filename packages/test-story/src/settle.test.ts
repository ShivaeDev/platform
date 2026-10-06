import { describe, expect, it } from "vitest";
import { hasBowls, hasDough, keepsSourdough, newBakery, ovenIsLit, ovenSmokes } from "#test/bakery.ts";

describe("a story settles or says why it cannot", () => {
	it("steps until the bakery settles and returns the report", () => {
		const { oven } = newBakery(ovenIsLit(), hasDough(3));

		expect(oven.bakesEverything()).toEqual({ loaves: 3, minutes: 3 });
	});

	it("returns at once when the bakery is already settled", () => {
		const { oven } = newBakery(ovenIsLit());

		expect(oven.bakesEverything(0)).toEqual({ loaves: 0, minutes: 0 });
	});

	it("narrates each step into the story", () => {
		const { baker, log, oven } = newBakery(ovenIsLit());

		baker.kneads(2);
		oven.bakesEverything();

		expect(log.lines).toEqual([
			"the oven is lit",
			"the baker kneads 2 balls of dough",
			"1m a loaf comes out of the oven",
			"2m a loaf comes out of the oven",
		]);
	});

	it("throws the failure the domain names instead of stepping on", () => {
		const { bakery, oven } = newBakery(hasDough(2));

		expect(() => oven.bakesEverything()).toThrow("the oven is cold with 2 balls of dough waiting");
		expect(bakery.minute).toBe(0);
	});

	it("throws the failure even when the bakery has also settled", () => {
		const { oven } = newBakery(ovenIsLit(), ovenSmokes());

		expect(() => oven.bakesEverything()).toThrow("the oven fills the bakery with smoke");
	});

	it("stops at the cap with the diagnosis and the last ten lines of the story", () => {
		const { oven } = newBakery(ovenIsLit(), keepsSourdough(), hasDough(1));

		expect(() => oven.bakesEverything(12)).toThrow(
			[
				"1 balls of dough still wait after 12 minutes: the sourdough starter never runs out",
				"last lines of the story:",
				...Array.from({ length: 10 }, (_, index) => `  ${index + 3}m a loaf comes out of the oven`),
			].join("\n"),
		);
	});

	it("takes no more steps than the cap allows", () => {
		const { bakery, oven } = newBakery(ovenIsLit(), hasBowls(2), hasDough(6));

		expect(() => oven.bakesEverything(4)).toThrow("2 balls of dough still wait after 4 minutes");
		expect(bakery.loaves).toBe(4);
	});
});
