import { Effect, Redacted, Schema } from "effect";
import type { JobPayloadSchema } from "#definition.ts";
import { PgBossPayloadError } from "#error.ts";
import { payloadOf } from "#internal/tracing.ts";

export function quotedSchema(schema: string): string {
	return `"${schema.replaceAll('"', '""')}"`;
}

export function decodeStoredData<const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
	queue: { readonly name: TName; readonly schema: TPayload },
	data: unknown,
): Effect.Effect<TPayload["Type"], PgBossPayloadError, TPayload["DecodingServices"]> {
	return Schema.decodeUnknownEffect(queue.schema)(payloadOf(data)).pipe(
		Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue: queue.name })),
	);
}
