import { Effect, Schema, Stream } from "effect";
import type { HttpClientResponse } from "effect/http";
import { ResponseBodyTooLarge } from "./errors.ts";

export const readBoundedBody = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse, limit: number) {
	const length = response.headers["content-length"];
	if (length !== undefined && Number(length) > limit) {
		return yield* new ResponseBodyTooLarge({ limit });
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	yield* response.stream.pipe(
		Stream.runForEach((chunk) => {
			size += chunk.byteLength;
			if (size > limit) {
				return Effect.fail(new ResponseBodyTooLarge({ limit }));
			}
			chunks.push(chunk);
			return Effect.void;
		}),
	);
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
});

export function readBoundedText(response: HttpClientResponse.HttpClientResponse, limit: number) {
	return Effect.map(readBoundedBody(response, limit), (bytes) => new TextDecoder().decode(bytes));
}

export function readBoundedJson<TSchema extends Schema.Constraint>(response: HttpClientResponse.HttpClientResponse, limit: number, schema: TSchema) {
	return Effect.flatMap(readBoundedText(response, limit), Schema.decodeUnknownEffect(Schema.fromJsonString(schema)));
}
