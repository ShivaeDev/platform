import { Effect, Option, Redacted, Schema } from "effect";
import { type PgBossError, PgBossPayloadError, toPgBossError } from "#error.ts";
import type { PgBossService } from "#service.ts";
import type { PgBossClient } from "./client.ts";
import { healthFor } from "./health.ts";

export const makeService = (client: PgBossClient, names: readonly string[]): PgBossService => ({
	enqueue: (queue, payload, options) =>
		Schema.encodeUnknownEffect(queue.schema)(payload).pipe(
			Effect.mapError(
				(error) =>
					new PgBossPayloadError({
						direction: "encode",
						original: Redacted.make(error),
						queue: queue.name,
					}),
			),
			Effect.flatMap((encoded): Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError> => {
				if (typeof encoded !== "object" || encoded === null) {
					return Effect.fail(
						new PgBossPayloadError({
							direction: "encode",
							original: Redacted.make(new TypeError("pg-boss payloads must encode to objects")),
							queue: queue.name,
						}),
					);
				}
				return Effect.tryPromise({
					catch: (error) => toPgBossError("enqueue", error, queue.name),
					try: () => client.send(queue.name, encoded, options),
				}).pipe(Effect.map(Option.fromNullishOr));
			}),
		),
	health: healthFor(client, names),
});
