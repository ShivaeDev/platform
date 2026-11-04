import { Effect } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { Order, type Rejected, SaveOrder } from "./contract.ts";
import { owned } from "./owned.ts";
import { OrdersRepository } from "./repository.ts";
import { unavailable } from "./unavailable.ts";

export const save = Effect.fn("OrderService.save")((userId: string, input: Order, beforeCommit: Effect.Effect<void, Rejected> = Effect.void) =>
	Effect.gen(function* () {
		const found = yield* owned(userId, input.id);
		const repository = yield* OrdersRepository;
		const saved = new Order(yield* repository.update({ ...found, ...input, name: input.name.trim() }));
		yield* invalidateOnCommit(invalidationKeys(SaveOrder.invalidates(input, saved)));
		yield* beforeCommit;
		return saved;
	}).pipe(
		Effect.catchTag("SchemaError", () => Effect.fail(unavailable())),
		transact({ onSqlError: unavailable }),
	),
);
