import { Schema } from "effect";
import { Order } from "./contract.ts";

export const DraftFields = Schema.Struct({
	name: Order.fields.name,
	quantity: Schema.NumberFromString,
});

export type DraftFields = typeof DraftFields.Type;

export function valuesOf(order: Order) {
	return {
		name: order.name,
		quantity: String(order.quantity),
	};
}
