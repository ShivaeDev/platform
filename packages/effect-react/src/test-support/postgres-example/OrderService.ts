import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { Missing, Order, type Rejected, SaveOrder, Unavailable } from "./contract.ts";
import { OrdersRepository } from "./repository.ts";

function owned(userId: string, id: number) {
	return OrdersRepository.use((repository) => repository.findById(id)).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new Missing())),
		Effect.filterOrFail(
			(row) => row.ownerId === userId,
			() => new Missing(),
		),
	);
}
function unavailable() {
	return new Unavailable();
}
export const OrderService = defineService({
	id: "postgres-example/Service",
	initialize: Effect.void,
	methods: () => ({
		get: (userId: string, id: number) =>
			owned(userId, id).pipe(
				Effect.map((row) => new Order(row)),
				Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
			),
		save: (userId: string, input: Order, beforeCommit: Effect.Effect<void, Rejected> = Effect.void) =>
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
	}),
	requires: [OrdersRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
