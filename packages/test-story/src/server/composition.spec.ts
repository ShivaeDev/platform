import { expect } from "vitest";
import { hasDough, ovenIsLit } from "#test/bakery.ts";
import { market, village } from "#test/market.ts";
import { sailsAreTurning } from "#test/mill.ts";
import { loafOrdered } from "#test/orders.ts";
import { flourInStock } from "#test/stock.ts";
import { storyRunner } from "#test/storyRunner.ts";

const SACKS_TO_GRIND = 3;
const DOUGH_TO_BAKE = 2;

market.it("runs the stock feature's trait with its layer and answers through its verb", [flourInStock], function* ({ stock }) {
	expect(yield* stock.read()).toBe("rye flour");
});

market.it("runs the orders feature's trait with its layer and answers through its verb", [loafOrdered], function* ({ orders }) {
	expect(yield* orders.read()).toBe("a loaf of rye");
});

market.it("tells both features' lines in the order the story ran them", [loafOrdered, flourInStock], function* ({ orders, stock, story }) {
	yield* stock.read();
	yield* orders.read();

	expect(story.lines).toEqual(["a loaf is ordered", "flour is in stock", "read the stock", "read the order"]);
});

market.it("runs on the clock of the first feature that names one", [], function* ({ stock }) {
	expect(yield* stock.clock()).toBe("the live clock");
});

const MARKET_LIFETIME = [
	"stock around",
	"orders around",
	"stock create",
	"orders create",
	"stock trait",
	"stock after",
	"orders trait",
	"orders after",
	"orders after closed",
	"orders trait closed",
	"stock after closed",
	"stock trait closed",
	"orders create closed",
	"stock create closed",
	"orders around closed",
	"stock around closed",
];

for (const [ending, name] of [
	["passes", "Extended Market Story: reads the stock and the order"],
	["fails", "Extended Market Story: fails after reading the stock and the order"],
] as const) {
	storyRunner.it(
		`opens an inherited kit's features in the order it extends them and closes them in reverse when the story ${ending}`,
		[],
		function* ({ lifetime, runStory }) {
			yield* runStory("compositionStories", name);

			expect(yield* lifetime()).toEqual(MARKET_LIFETIME);
		},
	);
}

village.it("runs the mill's traits when the village joins the mill and the bakery", [sailsAreTurning()], ({ sails }) => {
	expect(sails()).toBe("turning");
});

village.it("keeps the mill's verbs when the village joins the mill and the bakery", [], ({ miller, sacks }) => {
	expect(sacks()).toBe(0);

	miller.grinds(SACKS_TO_GRIND);

	expect(sacks()).toBe(SACKS_TO_GRIND);
});

village.it(
	"keeps the bakery's stepped verbs when the village joins the mill and the bakery",
	[ovenIsLit(), hasDough(DOUGH_TO_BAKE)],
	function* ({ oven }) {
		yield* oven.bakesEverything();

		expect(oven.loaves()).toBe(DOUGH_TO_BAKE);
	},
);
