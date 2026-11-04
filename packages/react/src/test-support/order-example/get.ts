import { Effect } from "effect";
import { owned } from "./owned.ts";
import { publicOrder } from "./public.ts";
import { unavailable } from "./unavailable.ts";

export const get = Effect.fn("OrderService.get")((userId: string, id: number) =>
	owned(userId, id).pipe(
		Effect.map(publicOrder),
		Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
	),
);
