import { Effect, Schema } from "effect";
import type { CachedResponse } from "./cache.ts";

export const decodeJson = Effect.fnUntraced(function* <TSchema extends Schema.Constraint>(entry: CachedResponse, schema: TSchema) {
	const cached = entry.decoded.get(schema);
	if (entry.decoded.has(schema) && Schema.is(schema)(cached)) {
		return cached;
	}
	const value = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(new TextDecoder().decode(entry.bytes));
	entry.decoded.set(schema, value);
	return value;
});

export function jsonResponse(entry: CachedResponse) {
	return { decode: <TSchema extends Schema.Constraint>(schema: TSchema) => decodeJson(entry, schema) };
}
