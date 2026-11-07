import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { extendedMarket, village } from "#test/market.ts";
import { loafOrdered } from "#test/orders.ts";
import { flourInStock } from "#test/stock.ts";

extendedMarket.it("reads the stock and the order", [loafOrdered, flourInStock], function* ({ orders, stock }) {
	yield* stock.read();
	yield* orders.read();
});

extendedMarket.it("fails after reading the stock and the order", [loafOrdered, flourInStock], function* ({ orders, stock }) {
	yield* stock.read();
	yield* orders.read();
	yield* Effect.fail("the market closes early");
});

village.it("fails after grinding sacks", [], ({ miller, sacks }) => {
	miller.grinds(3);

	expect(sacks()).toBe(0);
});
