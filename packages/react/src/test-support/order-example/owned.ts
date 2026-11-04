import { Effect } from "effect";
import { OrderNotFound } from "./contract.ts";
import { OrdersRepository } from "./repository.ts";

export function owned(userId: string, id: number) {
	return OrdersRepository.use((repository) => repository.findById(id)).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new OrderNotFound())),
		Effect.filterOrFail(
			(row) => row.ownerId === userId,
			() => new OrderNotFound(),
		),
	);
}
