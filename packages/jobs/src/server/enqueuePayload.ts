import { Effect, Redacted, Schema } from "effect";
import { payloadJobId, payloadKey } from "#server/adapters/payloadIdentity.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";
import type { EnqueueOptions, QueueEnqueueOptions } from "#server/enqueueOptions.ts";
import { PgBossPayloadError } from "#server/error.ts";
import { PgBossOperations } from "#server/services/operations/service.ts";
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

export const enqueuePayload = Effect.fnUntraced(function* <
	const TName extends string,
	const TPayload extends JobPayloadSchema,
	const TQueue extends QueueDefinition<TName, TPayload>,
>(queue: QueueDefinition<TName, TPayload> & TQueue, payload: NoInfer<Schema.Schema.Type<TPayload>>, options?: NoInfer<QueueEnqueueOptions<TQueue>>) {
	const operations = yield* PgBossOperations;
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
	const sendOptions = identityOptions(queue, payload, options);
	return yield* operations.enqueue(queue.name, data, sendOptions);
});
