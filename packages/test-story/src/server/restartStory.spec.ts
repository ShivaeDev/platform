import { expect } from "@effect/vitest";
import { bakery, hasBowls, hasDough, hasFlourDelivered, ovenIsLit } from "#test/bakery.ts";
import { contextCounter, startsAt } from "#test/contextCounter.ts";

bakery.it(
	"restarts with fresh traits, applies more dough and keeps the first engine readable",
	[ovenIsLit(), hasDough(1)],
	function* ({ oven, story }) {
		yield* oven.bakesEverything();
		expect(oven.loaves()).toBe(1);

		const second = yield* story.restart([ovenIsLit(), hasDough(2)]);

		expect(second.oven.loaves()).toBe(0);
		yield* second.oven.bakesEverything();
		expect(second.oven.loaves()).toBe(2);
		expect(oven.loaves()).toBe(1);

		yield* second.story.apply([hasDough(1)]);
		yield* second.oven.bakesEverything();

		expect(second.oven.loaves()).toBe(3);
		expect(oven.loaves()).toBe(1);
	},
);

bakery.it(
	"applies bundled traits mid-story in stage order with after hooks and layer services",
	[ovenIsLit(), hasDough(1)],
	function* ({ oven, pantry, kitchen, story }) {
		yield* oven.bakesEverything();
		expect(oven.loaves()).toBe(1);
		expect(pantry.dough()).toBe(0);

		yield* story.apply([bakery.traits(hasDough(4), hasBowls(2), hasFlourDelivered(2))]);

		expect(kitchen.capacity()).toBe(6);
		expect(pantry.dough()).toBe(4);
		expect(pantry.flour()).toBe(2);
		yield* oven.bakesEverything();
		expect(oven.loaves()).toBe(5);
		expect(story.lines).toContain("the baker has 4 balls of dough");
	},
);

contextCounter.it("steps each restarted engine with the services its own stage provided", [], function* ({ advance, count, story }) {
	yield* advance();
	expect(count()).toBe(1);

	const second = yield* story.restart([startsAt(10)]);
	yield* second.advance();

	expect(second.count()).toBe(11);
	expect(count()).toBe(1);
});
