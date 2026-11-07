import { Effect } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { BeforeOrderCommit } from "#test/postgres-example/BeforeOrderCommit.ts";
import { Order, SaveOrder } from "#test/postgres-example/contract.ts";
import { owned } from "#test/postgres-example/owned.ts";
import { OrdersRepository } from "#test/postgres-example/repository.ts";
import { unavailable } from "#test/postgres-example/unavailable.ts";

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
