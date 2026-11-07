import { Effect } from "effect";
import { owned } from "#test/order-example/owned.ts";
import { publicOrder } from "#test/order-example/public.ts";
import { unavailable } from "#test/order-example/unavailable.ts";

export const get = Effect.fn("OrderService.get")((id: number) =>
	owned(id).pipe(
		Effect.map(publicOrder),
		Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
	),
);
