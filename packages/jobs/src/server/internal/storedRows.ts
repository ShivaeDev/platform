import { Effect, Redacted, Schema } from "effect";
import type { JobPayloadSchema, QueueDefinition } from "#definition.ts";
import { PgBossPayloadError } from "#error.ts";
import { payloadOf } from "#internal/tracing.ts";

export function quotedSchema(schema: string): string {
	return `"${schema.replaceAll('"', '""')}"`;
}

export function decodeStoredData<const TName extends string, const TPayload extends JobPayloadSchema>(
	queue: Pick<QueueDefinition<TName, TPayload>, "name" | "schema">,
	data: unknown,
): Effect.Effect<TPayload["Type"], PgBossPayloadError, TPayload["DecodingServices"]> {
	return Schema.decodeUnknownEffect(queue.schema)(payloadOf(data)).pipe(
		Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue: queue.name })),
	);
}
