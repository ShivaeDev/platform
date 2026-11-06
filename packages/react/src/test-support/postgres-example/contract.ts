import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export class Order extends Schema.Class<Order>("Order")({ id: Schema.Number, name: Schema.String, quantity: Schema.Number }) {}
export class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
export const orders = collection("orders", Order.fields.id);
export const GetOrder = query("get", {
	payload: { id: Order.fields.id },
	readPolicy: () => Effect.succeed(true),
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
