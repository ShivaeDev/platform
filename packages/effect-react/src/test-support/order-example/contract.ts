import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";

export class Order extends Schema.Class<Order>("Order")({
	id: Schema.Number,
	name: Schema.String,
	quantity: Schema.Number,
}) {}
export const OrderDraft = Schema.Struct({ name: Order.fields.name, quantity: Order.fields.quantity });
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
export class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("OrderNotFound", {}) {}
export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {}) {}
export class Principal extends Context.Service<Principal, { readonly userId: string }>()("order/Principal") {}
export class Authentication extends RpcMiddleware.Service<Authentication, { provides: Principal }>()("order/Authentication", {
	error: Unauthorized,
}) {}

export const orders = collection("orders", Order.fields.id);
export const GetOrder = query("get", {
	payload: { id: Order.fields.id },
	reads: ({ id }) => [orders.item(id)],
	rejections: { OrderNotFound, StorageUnavailable },
	success: Order,
});
export const ListOrders = query("list", {
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

export const Orders = contract("orders", { commands: [SaveOrder], queries: [GetOrder, ListOrders] }).middleware(Authentication);
