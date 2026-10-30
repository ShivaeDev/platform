import { Effect } from "effect";
import { extendedMarket } from "./market.ts";
import { loafOrdered } from "./orders.ts";
import { flourInStock } from "./stock.ts";

extendedMarket.it("reads the stock and the order", [loafOrdered, flourInStock], function* ({ orders, stock }) {
	yield* stock.read();
	yield* orders.read();
});

extendedMarket.it("fails after reading the stock and the order", [loafOrdered, flourInStock], function* ({ orders, stock }) {
	yield* stock.read();
	yield* orders.read();
	yield* Effect.fail("the market closes early");
});
