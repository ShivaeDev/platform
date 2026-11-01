import { Effect, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { CachedResponse } from "./cache.ts";

export const decodeJson = Effect.fnUntraced(function* <TSchema extends Schema.Constraint>(entry: CachedResponse, schema: TSchema) {
	if (entry.response.status === HttpStatus.fromLiteral("NoContent")) {
		return yield* Schema.decodeUnknownEffect(schema)(undefined);
	}
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
