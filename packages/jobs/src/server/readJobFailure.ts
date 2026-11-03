import { Effect, Redacted, Schema } from "effect";
import { JobFailure } from "#JobFailure.ts";
import { PgBossPayloadError } from "#server/error.ts";

const StoredFailure = Schema.NullOr(Schema.Union([JobFailure, Schema.Struct({ value: JobFailure })]));

export function readJobFailure(queue: string, output: unknown): Effect.Effect<JobFailure | null, PgBossPayloadError> {
	return Schema.decodeUnknownEffect(StoredFailure)(output).pipe(
		Effect.map((failure) => (failure !== null && "value" in failure ? failure.value : failure)),
		Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue })),
	);
}
