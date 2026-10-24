import { Schema } from "effect";
import { Rpc } from "effect/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";

export class Order extends Schema.Class<Order>("Order")({ id: Schema.Number, name: Schema.String, quantity: Schema.Number }) {}
export class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
export const orders = collection("orders", Order.fields.id);
export const GetOrder = query("get", {
	payload: { id: Order.fields.id },
	reads: ({ id }) => [orders.item(id)],
	rejections: { Missing, Unavailable },
	success: Order,
});
export const SaveOrder = command("save", {
	invalidates: ({ id }) => [orders.item(id)],
	payload: Order.fields,
	rejections: { Missing, Rejected, Unavailable },
	success: Order,
});
export const Orders = contract("orders", { commands: [SaveOrder], queries: [GetOrder] }).middleware(Authenticated);
const Subscribe = Rpc.make("subscribe", {
	error: Schema.Union([Missing, Unavailable]),
	payload: { id: Order.fields.id },
	stream: true,
	success: LiveHint,
}).middleware(Authenticated);
export const LiveOrders = Orders.add(Subscribe);
export const ApplicationOrders = Orders.application.add(Subscribe);
