import { Effect, Option, Redacted, Schema } from "effect";
import type { PgBossClient } from "#client.ts";
import { PgBossPayloadError, toPgBossError } from "#error.ts";
import { capturePayload } from "#internal/tracing.ts";
import { transactionDb } from "#internal/transactionDb.ts";
import type { PgBossService } from "#service.ts";

export function enqueueFor(client: PgBossClient): PgBossService["enqueue"] {
	return (queue, payload, options) =>
		Effect.gen(function* () {
			const encoded = yield* Schema.encodeUnknownEffect(queue.schema)(payload).pipe(
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
