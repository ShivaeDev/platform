import { Effect } from "effect";
import { Identity } from "@shivaedev/identity/identity.ts";
import { OrderNotFound } from "#test/order-example/contract.ts";
import { OrdersRepository } from "#test/order-example/repository.ts";

export const owned = Effect.fn("OrderService.owned")(function* (id: number) {
	const { id: userId } = yield* Identity;
	const repository = yield* OrdersRepository;
	return yield* repository.findById(id).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new OrderNotFound())),
		Effect.filterOrFail(
			(row) => row.ownerId === userId,
			() => new OrderNotFound(),
		),
	);
});
