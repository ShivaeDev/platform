import { describe, expect, it } from "vitest";
import { hasBowls, hasDough, morningShift, newBakery } from "#test/bakery.ts";

describe("a story sets up its bakery in stages", () => {
	const startedOutside = newBakery(hasBowls(2));

	it("runs a story started outside a test", () => {
		expect(startedOutside.story.engine.capacity).toBe(6);
	});

	it("fills the pantry after the kitchen, whatever order the test names them in", () => {
		const { story } = newBakery(hasDough(6), hasBowls(2));

		expect(story.engine.dough).toBe(6);
	});

	it("runs the hook after a stage even when no trait names that stage", () => {
		const { story } = newBakery(hasDough(3));

		expect(story.engine.capacity).toBe(3);
	});

	it("tells one line per trait, in the order the test names them", () => {
		const { story } = newBakery(hasDough(2), morningShift());

		expect(story.lines).toEqual(["the baker has 2 balls of dough", "the oven is lit", "the bakery has 1 bowls"]);
	});

	it("starts every story on a fresh bakery", () => {
		newBakery(hasBowls(2), hasDough(6));

		expect(newBakery().story.engine.dough).toBe(0);
	});

	it("refuses a bakery that cannot exist, naming the trait, the cause and what to do", () => {
		expect(() => newBakery(hasBowls(1), hasDough(5))).toThrow(
			[
				'the trait "the baker has 5 balls of dough" refused to set up the bakery: the bowls hold only 3',
				"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait in the bakery story kit if this bakery should be possible.",
			].join("\n"),
		);
	});

	it("keeps what the trait threw as the cause of the refusal", () => {
		expect(() => newBakery(hasDough(4))).toThrow(expect.objectContaining({ cause: new Error("the bowls hold only 3") }));
	});
});
