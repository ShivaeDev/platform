import { Effect, Option, Redacted, Schema } from "effect";
import type { PgBossClient } from "#client.ts";
import { PgBossPayloadError, toPgBossError } from "#error.ts";
import { payloadOf } from "#internal/tracing.ts";
import type { PgBossService } from "#service.ts";

export function getJobFor(client: PgBossClient): PgBossService["getJob"] {
	return (queue, id) =>
		Effect.tryPromise({
			catch: (error) => toPgBossError("getJob", error, queue.name),
			try: async () => {
				if (client.findJobs === undefined) {
					throw new TypeError("This pg-boss client does not support findJobs");
				}
				return (await client.findJobs(queue.name, { id }))[0];
			},
		}).pipe(
			Effect.flatMap((job) =>
				job === undefined
					? Effect.succeed(Option.none())
					: Schema.decodeUnknownEffect(queue.schema)(payloadOf(job.data)).pipe(
							Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue: queue.name })),
							Effect.map((data) => Option.some({ ...job, data })),
						),
			),
		);
}

export function retryFor(client: PgBossClient): PgBossService["retry"] {
	return (queue, id) =>
		Effect.tryPromise({
			catch: (error) => toPgBossError("retry", error, queue.name),
			try: async () => {
				if (client.findJobs === undefined || client.retry === undefined || client.update === undefined) {
					throw new TypeError("This pg-boss client does not support findJobs, retry and update");
				}
				const job = (await client.findJobs(queue.name, { id }))[0];
				if (job?.state !== "failed" && job?.state !== "retry") {
					return;
				}
				if (job.state === "failed") {
					await client.retry(queue.name, id);
				}
				await client.update(queue.name, undefined, { id, startAfter: 0 });
			},
		});
}
