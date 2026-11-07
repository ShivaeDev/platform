import { Effect } from "effect";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Order } from "#test/order-example/contract.ts";
import { OrdersRepository } from "#test/order-example/repository.ts";
import { unavailable } from "#test/order-example/unavailable.ts";

export const list = Effect.fn("OrderService.list")(function* () {
	const { id } = yield* Identity;
	const repository = yield* OrdersRepository;
	return yield* repository.findMany({ orderBy: { direction: "asc", field: "id" }, where: { ownerId: id } }).pipe(
		Effect.map((rows) => rows.map((row) => new Order(row))),
		Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
	);
});
