import { Schema, SchemaGetter } from "effect";

export function emptyAsNull<TSchema extends Schema.Constraint & Schema.Top>(
	inner: TSchema,
): Schema.Codec<TSchema["Type"] | null, TSchema["Encoded"] | "", TSchema["DecodingServices"], TSchema["EncodingServices"]> {
	return Schema.Union([Schema.Literal(""), inner]).pipe(
		Schema.decodeTo(Schema.NullOr(Schema.toType(inner)), {
			decode: SchemaGetter.transform((value) => (value === "" ? null : value)),
			encode: SchemaGetter.transform((value) => (value === null ? "" : value)),
		}),
	);
}
