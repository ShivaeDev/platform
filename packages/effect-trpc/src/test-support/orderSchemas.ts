import { Schema } from "effect";
import { command } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
export class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("OrderNotFound", {}) {}
const Draft = Schema.Struct({ name: Schema.String, quantity: Schema.Number });
export const Place = command("place", {
	invalidates: () => [],
	payload: Draft,
	rejections: { Invalid: fieldRejection(Draft), OrderNotFound },
	success: Schema.String,
});
export const Forget = command("forget", { invalidates: () => [] });
