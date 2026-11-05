import { Effect } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { SaveOrder, type SaveOrderInput } from "./contract.ts";
import { owned } from "./owned.ts";
import { publicOrder } from "./public.ts";
import { OrdersRepository } from "./repository.ts";
import { unavailable } from "./unavailable.ts";

export const save = Effect.fn("OrderService.save")((input: SaveOrderInput) =>
	Effect.gen(function* () {
		const found = yield* owned(input.id);
		const name = input.name.trim();
		if (name.length === 0) {
			return yield* SaveOrder.reject.OrderValidation({ field: "name", message: "Enter an order name" });
		}
		const repository = yield* OrdersRepository;
		const saved = publicOrder(yield* repository.update({ ...found, name, quantity: input.quantity }));
		yield* invalidateOnCommit(invalidationKeys(SaveOrder.invalidates(input, saved)));
		if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > 5000) {
			return yield* SaveOrder.reject.OrderValidation({ field: "quantity", message: "Quantity must be a whole number between 0 and 5000" });
		}
		return saved;
	}).pipe(
		Effect.catchTag("SchemaError", () => Effect.fail(unavailable())),
		transact({ onSqlError: unavailable }),
	),
);
