import { Effect } from "effect";
import { Order } from "./contract.ts";
import { owned } from "./owned.ts";
import { unavailable } from "./unavailable.ts";

export const get = Effect.fn("OrderService.get")((id: number) =>
	owned(id).pipe(
		Effect.map((row) => new Order(row)),
		Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
	),
);
