import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Schema, SchemaGetter } from "effect";

export function jsonb<TSchema extends Schema.Top>(schema: TSchema) {
	return Schema.Unknown.pipe(
		Schema.decodeTo(Schema.Unknown, {
			decode: SchemaGetter.transform((value) => (PgTypes.isParameter(value) ? value.value : value)),
			encode: SchemaGetter.transform(PgTypes.jsonb),
		}),
		Schema.decodeTo(schema),
	);
}
