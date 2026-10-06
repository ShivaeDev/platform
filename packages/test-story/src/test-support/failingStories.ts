import { expect } from "@effect/vitest";
import { bakery, hasBowls, hasDough, hasOrders, ovenIsLit } from "#test/bakery.ts";
import { mill, sailsAreTurning } from "#test/mill.ts";

bakery.it("adds nothing when the story passes", [ovenIsLit(), hasDough(1)], function* ({ oven }) {
	expect((yield* oven.bakesEverything()).loaves).toBe(1);
});

bakery.it("marks where an assertion stopped the story", [ovenIsLit(), hasDough(1)], function* ({ oven }) {
	expect((yield* oven.bakesEverything()).loaves, "loaves").toBe(2);
});

bakery.it("marks the trait that refused", [ovenIsLit(), hasDough(4), hasBowls(1)]);

bakery.it("prints the story when the bakery breaks", [hasDough(1)], function* ({ oven }) {
	yield* oven.bakesEverything();
});

mill.it("prints what the kit's inspect shows", [sailsAreTurning()], ({ miller, story }) => {
	miller.grinds(2);

	expect(story.engine.wind, "wind").toBe(1);
});

mill.it("marks a failure before the story told a line", [], ({ story }) => {
	expect(story.engine.sacks, "sacks").toBe(1);
});

bakery.it("writes a bakery too large to print to a file", [hasOrders(60)], ({ story }) => {
	expect(story.engine.orders, "orders").toHaveLength(0);
});

mill.it("splits the rerun command when a long test name would carry it past the width of a terminal", [], ({ story }) => {
	expect(story.engine.sacks, "sacks").toBe(1);
});
