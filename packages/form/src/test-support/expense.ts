import { Effect, Layer, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const NonNegativeFinite = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
const PositiveFinite = Schema.Finite.check(Schema.isGreaterThan(0));
const MoneyInput = Schema.String.pipe(
	Schema.decodeTo(NonNegativeFinite, {
		decode: SchemaGetter.transform((value) => Number(value) || 0),
		encode: SchemaGetter.transform(String),
	}),
);
const QuantityInput = Schema.String.pipe(
	Schema.decodeTo(Schema.NullOr(PositiveFinite), {
		decode: SchemaGetter.transform((value) => {
			const quantity = Number(value);
			return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
		}),
		encode: SchemaGetter.transform((value) => (value === null ? "" : String(value))),
	}),
);
const ExpenseEntry = Schema.Struct({
	date: Schema.optional(Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u))),
	payee: Schema.Trim.check(Schema.isMinLength(1)),
	quantity: QuantityInput,
	subtotal: MoneyInput,
});
export const initial: typeof ExpenseEntry.Encoded = {
	payee: "  Northwind Cabs  ",
	quantity: "",
	subtotal: "120.5",
};

export const expenses = formStories(
	() => ExpenseEntry,
	() => ({ initialValues: initial, onSubmit: Effect.succeed, runtime: Atom.runtime(Layer.empty) }),
);
