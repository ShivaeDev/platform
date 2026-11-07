import { Context, type Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { Order } from "#test/order-example/contract.ts";

export class OrderRow extends Model.Class<OrderRow>("OrderRow")({
	...Order.fields,
	id: Model.Field({ json: Order.fields.id, select: Order.fields.id, update: Order.fields.id }),
	ownerId: Schema.String,
}) {}
export const makeOrdersRepository = makeRepository(OrderRow, { idColumn: "id", spanPrefix: "Orders", tableName: "orders" });
export class OrdersRepository extends Context.Service<OrdersRepository, Effect.Success<typeof makeOrdersRepository>>()(
	"@shivaedev/react/order/Repository",
) {}
