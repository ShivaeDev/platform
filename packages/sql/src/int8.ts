import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Schema, SchemaGetter, SchemaParser } from "effect";

export function int8<TField extends Schema.Top & { readonly Encoded: bigint }>(field: TField) {
	return Schema.Unknown.pipe(
		Schema.decodeTo(Schema.BigInt, {
			decode: SchemaGetter.transformEffect((value) =>
				SchemaParser.decodeUnknownEffect(Schema.BigInt)(PgTypes.isParameter(value) ? value.value : value),
			),
			encode: SchemaGetter.transform(PgTypes.int8),
		}),
		Schema.decodeTo(field),
	);
}
