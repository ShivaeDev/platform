import { Schema } from "effect";
import { Order } from "#test/order-example/contract.ts";

export const DraftFields = Schema.Struct({
	name: Order.fields.name,
	quantity: Schema.NumberFromString,
});

export type DraftFields = typeof DraftFields.Type;
