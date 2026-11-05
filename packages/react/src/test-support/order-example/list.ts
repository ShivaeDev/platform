import { Effect } from "effect";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Order } from "./contract.ts";
import { OrdersRepository } from "./repository.ts";
import { unavailable } from "./unavailable.ts";

export const list = Effect.fn("OrderService.list")(function* () {
	const { id } = yield* Identity;
	const repository = yield* OrdersRepository;
	return yield* repository.findMany({ orderBy: { direction: "asc", field: "id" }, where: { ownerId: id } }).pipe(
		Effect.map((rows) => rows.map((row) => new Order(row))),
		Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
	);
});
