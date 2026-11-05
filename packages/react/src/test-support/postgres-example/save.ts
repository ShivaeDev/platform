import { Effect } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { BeforeOrderCommit } from "./BeforeOrderCommit.ts";
import { Order, SaveOrder } from "./contract.ts";
import { owned } from "./owned.ts";
import { OrdersRepository } from "./repository.ts";
import { unavailable } from "./unavailable.ts";

export const save = Effect.fn("OrderService.save")((input: Order) =>
	Effect.gen(function* () {
		const found = yield* owned(input.id);
		const repository = yield* OrdersRepository;
		const saved = new Order(yield* repository.update({ ...found, ...input, name: input.name.trim() }));
		yield* invalidateOnCommit(invalidationKeys(SaveOrder.invalidates(input, saved)));
		yield* yield* BeforeOrderCommit;
		return saved;
	}).pipe(
		Effect.catchTag("SchemaError", () => Effect.fail(unavailable())),
		transact({ onSqlError: unavailable }),
	),
);
