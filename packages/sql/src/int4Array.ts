import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Result, Schema, SchemaGetter, SchemaParser } from "effect";

const Integers = Schema.Array(Schema.Int);

export function int4Array<TField extends Schema.Top & { readonly Encoded: readonly number[] }>(field: TField) {
	return Schema.Unknown.pipe(
		Schema.decodeTo(Integers, {
			decode: SchemaGetter.transformEffect((value) => SchemaParser.decodeUnknownEffect(Integers)(PgTypes.isParameter(value) ? value.value : value)),
			encode: SchemaGetter.transform((values) => Result.getOrThrow(PgTypes.array(values, PgTypes.OID.int4))),
		}),
		Schema.decodeTo(field),
	);
}
