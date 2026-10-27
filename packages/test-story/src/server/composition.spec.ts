import { Clock, Effect, Scope } from "effect";
import { afterAll, expect } from "vitest";
import { hasDough, ovenIsLit } from "#test/bakery.ts";
import { compositionEvents } from "#test/compositionLifetime.ts";
import { extendedMarket, market, village } from "#test/market.ts";
import { sailsAreTurning } from "#test/mill.ts";
import { loafOrdered, OrderLabel } from "#test/orders.ts";
import { flourInStock, StockLabel } from "#test/stock.ts";

const SACKS_TO_GRIND = 3;
const DOUGH_TO_BAKE = 2;

market.it("runs both features' traits and verbs on one engine and Scope", [loafOrdered, flourInStock], function* ({ stock, orders, story }) {
	expect(yield* stock.read()).toBe("rye flour");
	expect(yield* orders.read()).toBe("a loaf of rye");
	expect(yield* StockLabel).toBe("rye flour");
	expect(yield* OrderLabel).toBe("a loaf of rye");
	expect(stock.engine()).toBe(story.engine);
	expect(orders.engine()).toBe(story.engine);
	expect(story.engine.stock.traitEngine).toBe(story.engine);
	expect(story.engine.orders.traitEngine).toBe(story.engine);
	expect(story.engine.stock.scope).toBe(yield* Scope.Scope);
	expect(story.engine.orders.scope).toBe(yield* Scope.Scope);
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
	expect(story.lines).toEqual(["a loaf is ordered", "flour is in stock", "read the stock", "read the order"]);
});

extendedMarket.it.fails("closes inherited features when the composed story fails", [flourInStock, loafOrdered], function* ({ stock, orders }) {
	expect(yield* stock.read()).toBe("rye flour");
	expect(yield* orders.read()).toBe("a loaf of rye");
	yield* Effect.fail("intentional failure");
});

village.it(
	"keeps a feature's stepped verbs when it joins another kit",
	[hasDough(DOUGH_TO_BAKE), sailsAreTurning(), ovenIsLit()],
	function* ({ miller, oven, story }) {
		miller.grinds(SACKS_TO_GRIND);
		yield* oven.bakesEverything();
		expect(story.engine.sacks).toBe(SACKS_TO_GRIND);
		expect(story.engine.sails).toBe("turning");
		expect(oven.loaves()).toBe(DOUGH_TO_BAKE);
	},
);

afterAll(() => {
	const events = [
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
	expect(compositionEvents.length).toBeGreaterThanOrEqual(events.length * 2);
	for (let start = 0; start < compositionEvents.length; start += events.length) {
		expect(compositionEvents.slice(start, start + events.length)).toEqual(events);
	}
});
