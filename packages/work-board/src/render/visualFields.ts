import { Schema, SchemaTransformation } from "effect";

const NumberValue = Schema.String.check(Schema.isPattern(/\S/u)).pipe(Schema.decodeTo(Schema.Finite, SchemaTransformation.numberFromString));
const Count = NumberValue.check(Schema.makeFilter((value) => (Number.isSafeInteger(value) && value >= 0) || "Expected a nonnegative safe integer"));
const UnknownValue = Schema.Literal("unknown");

export const MetricFields = Schema.Struct({
	unit: Schema.String.check(Schema.isPattern(/\S/u)),
	value: Schema.optional(Schema.Union([NumberValue, UnknownValue])),
});
export const ProgressFields = Schema.Struct({
	completed: Schema.optional(Schema.Union([Count, UnknownValue])),
	total: Schema.optional(Schema.Union([Count, UnknownValue])),
});

export type MetricFields = typeof MetricFields.Type;
export type ProgressFields = typeof ProgressFields.Type;
