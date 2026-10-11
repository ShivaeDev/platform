import { Schema } from "effect";

export const jsonDecoder = <TSchema extends Schema.Constraint & { readonly DecodingServices: never }>(schema: TSchema) =>
	Schema.decodeUnknownResult(Schema.fromJsonString(schema));
