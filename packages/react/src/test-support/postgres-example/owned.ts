import { Effect } from "effect";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Missing } from "./contract.ts";
import { OrdersRepository } from "./repository.ts";

export const owned = Effect.fn("OrderService.owned")(function* (id: number) {
	const { id: userId } = yield* Identity;
	const repository = yield* OrdersRepository;
	return yield* repository.findById(id).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new Missing())),
		Effect.filterOrFail(
			(row) => row.ownerId === userId,
			() => new Missing(),
		),
	);
});
