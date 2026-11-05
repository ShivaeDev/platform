import { Effect, Schema } from "effect";
import { WatchError } from "#model.ts";

export function decode<TSchema extends Schema.Top>(schema: TSchema, body: unknown) {
	return Schema.decodeUnknownEffect(schema)(body).pipe(
		Effect.mapError((cause) => new WatchError({ message: "Invalid GitHub response", reason: "response" }, { cause })),
	);
}
