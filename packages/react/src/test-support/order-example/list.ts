import { Effect } from "effect";
import { Order } from "./contract.ts";
import { OrdersRepository } from "./repository.ts";
import { unavailable } from "./unavailable.ts";

export const list = Effect.fn("OrderService.list")((userId: string) =>
	OrdersRepository.use((repository) => repository.findMany({ orderBy: { direction: "asc", field: "id" }, where: { ownerId: userId } })).pipe(
		Effect.map((rows) => rows.map((row) => new Order(row))),
		Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
	),
);
