import { Effect } from "effect";
import { Order } from "#test/postgres-example/contract.ts";
import { owned } from "#test/postgres-example/owned.ts";
import { unavailable } from "#test/postgres-example/unavailable.ts";

export const get = Effect.fn("OrderService.get")((id: number) =>
	owned(id).pipe(
		Effect.map((row) => new Order(row)),
		Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
	),
);
