import { Context, Effect, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { Order, OrderNotFound, SaveOrder, type SaveOrderInput, StorageUnavailable } from "./contract.ts";

export class OrderRow extends Model.Class<OrderRow>("OrderRow")({
	...Order.fields,
	id: Model.Field({ json: Order.fields.id, select: Order.fields.id, update: Order.fields.id }),
	ownerId: Schema.String,
}) {}
function publicOrder(row: OrderRow) {
	return new Order({ id: row.id, name: row.name, quantity: row.quantity });
}
export const makeOrdersRepository = makeRepository(OrderRow, { idColumn: "id", spanPrefix: "Orders", tableName: "orders" });
export class OrdersRepository extends Context.Service<OrdersRepository, Effect.Success<typeof makeOrdersRepository>>()("order/Repository") {}

function unavailable() {
	return new StorageUnavailable();
}
function owned(userId: string, id: number) {
	return OrdersRepository.use((repository) => repository.findById(id)).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new OrderNotFound())),
		Effect.filterOrFail(
			(row) => row.ownerId === userId,
			() => new OrderNotFound(),
		),
	);
}

export const OrderService = defineService({
	id: "order/Service",
	initialize: Effect.void,
	methods: () => ({
		get: (userId: string, id: number) =>
			owned(userId, id).pipe(
				Effect.map(publicOrder),
				Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
			),
		list: (userId: string) =>
			OrdersRepository.use((repository) => repository.findMany({ orderBy: { direction: "asc", field: "id" }, where: { ownerId: userId } })).pipe(
				Effect.map((rows) => rows.map((row) => new Order(row))),
				Effect.catchTags({ SchemaError: () => Effect.fail(unavailable()), SqlError: () => Effect.fail(unavailable()) }),
			),
		save: (userId: string, input: SaveOrderInput) =>
			Effect.gen(function* () {
				const found = yield* owned(userId, input.id);
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
	}),
	requires: [OrdersRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
