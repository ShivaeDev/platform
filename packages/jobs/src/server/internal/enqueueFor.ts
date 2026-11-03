import { Effect, Option, Redacted, Schema } from "effect";
import { transactionDb } from "#server/adapters/transactionDb.ts";
import type { PgBossClient } from "#server/client.ts";
import { PgBossPayloadError, toPgBossError } from "#server/error.ts";
import { capturePayload } from "#server/internal/tracing.ts";
import type { PgBossService } from "#server/service.ts";

export function enqueueFor(client: PgBossClient): PgBossService["enqueue"] {
	return (queue, payload, options) =>
		Effect.gen(function* () {
			const encoded = yield* Schema.encodeUnknownEffect(Schema.toCodecJson(queue.schema))(payload).pipe(
				Effect.mapError((error) => new PgBossPayloadError({ direction: "encode", original: Redacted.make(error), queue: queue.name })),
			);
			if (typeof encoded !== "object" || encoded === null) {
				return yield* new PgBossPayloadError({
					direction: "encode",
					original: Redacted.make(new TypeError("pg-boss payloads must encode to objects")),
					queue: queue.name,
				});
			}
			const data = yield* capturePayload(encoded);
			const db = yield* transactionDb;
			const sendOptions = queue.key === undefined ? options : { ...options, singletonKey: queue.key(payload) };
			const send = Effect.tryPromise({
				catch: (error) => toPgBossError("enqueue", error, queue.name),
				try: () => client.send(queue.name, data, db === undefined ? sendOptions : { ...sendOptions, db }),
			});
			const id = yield* db === undefined ? send : Effect.uninterruptible(send);
			return Option.fromNullishOr(id);
		});
}
