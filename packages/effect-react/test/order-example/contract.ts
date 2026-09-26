import { collection, command, contract, fieldRejection, query } from "@shivaedev/effect-contract";
import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";

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
	success: Order,
	rejections: { OrderNotFound, StorageUnavailable },
	reads: ({ id }) => [orders.item(id)],
});
export const ListOrders = query("list", {
	success: Schema.Array(Order),
	rejections: { StorageUnavailable },
	reads: () => [orders.list],
});
export const SaveOrder = command("save", {
	payload: { id: Order.fields.id, ...OrderDraft.fields },
	success: Order,
	rejections: { OrderNotFound, OrderValidation: fieldRejection(OrderDraft), StorageUnavailable },
	invalidates: ({ id }) => [orders.item(id)],
});
export type SaveOrderInput = typeof SaveOrder.payload.Type;

export const Orders = contract("orders", { queries: [GetOrder, ListOrders], commands: [SaveOrder] }).middleware(Authentication);
