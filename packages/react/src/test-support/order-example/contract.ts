import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export class Order extends Schema.Class<Order>("Order")({
	id: Schema.Number,
	name: Schema.String,
	quantity: Schema.Number,
}) {}
export const OrderDraft = Schema.Struct({ name: Order.fields.name, quantity: Order.fields.quantity });
export class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("OrderNotFound", {}) {}
export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {}) {}

export const orders = collection("orders", Order.fields.id);
export const GetOrder = query("get", {
	payload: { id: Order.fields.id },
	readPolicy: () => Effect.succeed(true),
	reads: ({ id }) => [orders.item(id)],
	rejections: { OrderNotFound, StorageUnavailable },
	success: Order,
});
export const ListOrders = query("list", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [orders.list],
	rejections: { StorageUnavailable },
	success: Schema.Array(Order),
});
export const SaveOrder = command("save", {
	invalidates: ({ id }) => [orders.item(id)],
	payload: { id: Order.fields.id, ...OrderDraft.fields },
	rejections: { OrderNotFound, OrderValidation: fieldRejection(OrderDraft), StorageUnavailable },
	success: Order,
});
export type SaveOrderInput = typeof SaveOrder.payload.Type;

export const Orders = contract("orders", { commands: [SaveOrder], queries: [GetOrder, ListOrders] }).middleware(Authenticated);
