import { describe, expect, it } from "vitest";
import { hasBowls, hasDough, newBakery, ovenIsLit, traits } from "#test/bakery.ts";

describe("a story seeds its bakery in stages", () => {
	it("fills the pantry after the kitchen, whatever order the test names them in", () => {
		const { bakery } = newBakery(hasDough(6), hasBowls(2));

		expect(bakery.dough).toBe(6);
	});

	it("runs the hook after a stage even when no trait names that stage", () => {
		const { bakery } = newBakery(hasDough(3));

		expect(bakery.capacity).toBe(3);
	});

	it("tells one line per trait, in the order the test names them", () => {
		const { log } = newBakery(hasDough(2), morningShift());

		expect(log.lines).toEqual(["the baker has 2 balls of dough", "the oven is lit", "the bakery has 1 bowls"]);
	});

	it("refuses a bakery that cannot exist, naming the trait and why", () => {
		expect(() => newBakery(hasBowls(1), hasDough(5))).toThrow('trait "the baker has 5 balls of dough" refused: the bowls hold only 3');
	});

	it("keeps what the trait threw as the cause of the refusal", () => {
		expect(() => newBakery(hasDough(4))).toThrow(expect.objectContaining({ cause: new Error("the bowls hold only 3") }));
	});
});

function morningShift() {
	return traits(ovenIsLit(), hasBowls(1));
}
