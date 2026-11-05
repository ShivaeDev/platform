import { Effect, Option, Redacted, Schema } from "effect";
import { payloadJobId, payloadKey } from "#server/adapters/payloadIdentity.ts";
import { transactionDb } from "#server/adapters/transactionDb.ts";
import type { PgBossClient } from "#server/client.ts";
import type { QueueDefinition } from "#server/definition.ts";
import type { EnqueueOptions } from "#server/enqueueOptions.ts";
import { PgBossPayloadError, toPgBossError } from "#server/error.ts";
import type { PgBossService } from "#server/service.ts";
import { capturePayload } from "#server/tracing.ts";

function identityOptions(queue: Pick<QueueDefinition, "id" | "key" | "name">, payload: object, options?: EnqueueOptions) {
	return queue.id === undefined && queue.key === undefined
		? options
		: {
				...options,
				...(queue.id === undefined ? {} : { id: payloadJobId(queue.name, queue.id, payload) }),
				...(queue.key === undefined ? {} : { singletonKey: payloadKey(queue.key, payload) }),
			};
}

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
			const sendOptions = identityOptions(queue, payload, options);
			const send = Effect.tryPromise({
				catch: (error) => toPgBossError("enqueue", error, queue.name),
				try: () => client.send(queue.name, data, db === undefined ? sendOptions : { ...sendOptions, db }),
			});
			const id = yield* db === undefined ? send : Effect.uninterruptible(send);
			return Option.fromNullishOr(id);
		});
}
