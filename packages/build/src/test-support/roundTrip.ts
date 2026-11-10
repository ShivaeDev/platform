import { Schema } from "effect";

// What the browser decodes after the server encodes a value with the codec Effect RPC uses and JSON carries it.
export function roundTrip<TSchema extends Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never }>(
	schema: TSchema,
	value: TSchema["Type"],
): unknown {
	const codec = Schema.toCodecJson(schema);
	const sent = JSON.stringify(Schema.encodeUnknownSync(codec)(value));
	return Schema.decodeUnknownSync(codec)(JSON.parse(sent));
}

export function prototypeOf(value: unknown): unknown {
	return typeof value === "object" && value !== null ? Object.getPrototypeOf(value) : typeof value;
}
