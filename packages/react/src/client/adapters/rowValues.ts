import { Schema } from "effect";
import type { Fields } from "@shivaedev/form/shape.ts";

type Values = Readonly<Record<string, unknown>>;
type RowValues = (row: unknown) => Values;

const encoders = new WeakMap<Schema.Struct<Fields>, RowValues>();

// The hooks derive values only for fields that encode without services, which a struct's erased field type cannot show.
function serviceFree(fields: Schema.Struct<Fields>): Schema.Codec<Values, Values>;
function serviceFree(fields: unknown): unknown {
	return fields;
}

export function rowValues(fields: Schema.Struct<Fields>): RowValues {
	const existing = encoders.get(fields);
	if (existing !== undefined) {
		return existing;
	}
	const encode = Schema.encodeUnknownSync(serviceFree(fields));
	// A loaded row already passed its schema; checking it again would turn stored data that today's checks reject into a crash instead of a field error.
	const values: RowValues = (row) => encode(row, { disableChecks: true });
	encoders.set(fields, values);
	return values;
}
