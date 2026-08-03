import { Effect, Option, Redacted, Schema } from "effect";
import {
	type PgBossError,
	PgBossPayloadError,
	toPgBossError,
} from "../error.js";
import type { PgBossService } from "../service.js";
import type { PgBossClient } from "./client.js";
import { healthFor } from "./health.js";

export const makeService = (
	client: PgBossClient,
	names: readonly string[],
): PgBossService => ({
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
			Effect.flatMap(
				(
					encoded,
				): Effect.Effect<
					Option.Option<string>,
					PgBossError | PgBossPayloadError
				> => {
					if (typeof encoded !== "object" || encoded === null) {
						return Effect.fail(
							new PgBossPayloadError({
								direction: "encode",
								original: Redacted.make(
									new TypeError("pg-boss payloads must encode to objects"),
								),
								queue: queue.name,
							}),
						);
					}
					return Effect.tryPromise({
						try: () => client.send(queue.name, encoded, options),
						catch: (error) => toPgBossError("enqueue", error, queue.name),
					}).pipe(Effect.map(Option.fromNullishOr));
				},
			),
		),
	health: healthFor(client, names),
});
