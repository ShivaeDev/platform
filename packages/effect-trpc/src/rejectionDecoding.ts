import { Option, Schema } from "effect";

export const EncodedRejection = Schema.StructWithRest(
	Schema.Struct({ _tag: Schema.String, invalidInput: Schema.optionalKey(Schema.Literal(true)) }),
	[Schema.Record(Schema.String, Schema.Unknown)],
);

export type EncodedRejection = typeof EncodedRejection.Type;

const decodeCarrier = Schema.decodeUnknownOption(Schema.Struct({ data: Schema.Struct({ rejection: EncodedRejection }) }));

export function rejectionOf(error: unknown): Option.Option<EncodedRejection> {
	return Option.map(decodeCarrier(error), ({ data }) => data.rejection);
}

export function decodeRejection<TSchema extends Schema.ConstraintDecoder<{ readonly _tag: string }>>(
	schema: TSchema,
): (error: unknown) => Option.Option<TSchema["Type"]> {
	const decode = Schema.decodeUnknownOption(schema);
	return (error) => Option.flatMap(rejectionOf(error), (rejection) => decode(rejection));
}
