import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Schema, SchemaGetter } from "effect";

export function jsonStorage<TSchema extends Schema.Top>(schema: TSchema, parameter: (value: unknown) => PgTypes.Parameter) {
	return Schema.Unknown.pipe(
		Schema.decodeTo(Schema.Unknown, {
			decode: SchemaGetter.transform((value) => (PgTypes.isParameter(value) ? value.value : value)),
			encode: SchemaGetter.transform(parameter),
		}),
		Schema.decodeTo(schema),
	);
}
