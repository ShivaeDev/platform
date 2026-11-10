import { Schema, SchemaGetter } from "effect";
import { rowMapping } from "#adapters/groupColumns.ts";
import type { SqlNameTransforms } from "#clientOptions.ts";

export function storageSchema<TSchema extends Schema.Constraint>(schema: TSchema, fields: Schema.Struct.Fields, names?: SqlNameTransforms) {
	const mapping = rowMapping(fields, names);
	return Schema.Record(Schema.String, Schema.Unknown).pipe(
		Schema.decodeTo(schema, { decode: SchemaGetter.transform(mapping.expand), encode: SchemaGetter.transform(mapping.flatten) }),
	);
}
