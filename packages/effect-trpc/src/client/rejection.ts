import { Option, Schema } from "effect";

export const EncodedRejection = Schema.StructWithRest(
	Schema.Struct({ _tag: Schema.String, invalidInput: Schema.optionalKey(Schema.Literal(true)) }),
	[Schema.Record(Schema.String, Schema.Unknown)],
);

export type EncodedRejection = typeof EncodedRejection.Type;

const decodeCarrier = Schema.decodeUnknownOption(Schema.Struct({ data: Schema.Struct({ rejection: EncodedRejection }) }));

export const rejectionOf = (error: unknown): Option.Option<EncodedRejection> => Option.map(decodeCarrier(error), ({ data }) => data.rejection);

export const decodeRejection = <S extends Schema.ConstraintDecoder<{ readonly _tag: string }>>(
	schema: S,
): ((error: unknown) => Option.Option<S["Type"]>) => {
	const decode = Schema.decodeUnknownOption(schema);
	return (error) => Option.flatMap(rejectionOf(error), (rejection) => decode(rejection));
};
