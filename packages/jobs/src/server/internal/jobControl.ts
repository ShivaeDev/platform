import { Effect, Option, Redacted, Schema } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import type { PgBossClient } from "#client.ts";
import { PgBossPayloadError, toPgBossError } from "#error.ts";
import { deferralOf } from "#internal/deferral.ts";
import { decodeStoredData } from "#internal/storedRows.ts";
import { JobFailure } from "#JobFailure.ts";
import type { PgBossService } from "#service.ts";

function decodeFailure(queue: string, output: unknown) {
	return Schema.decodeUnknownEffect(JobFailure)(output).pipe(
		Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue })),
	);
}

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
			Effect.flatMap(
				Effect.fnUntraced(function* (job) {
					if (job === undefined) {
						return Option.none();
					}
					const data = yield* decodeStoredData(queue, job.data);
					const output = job.output === null || deferralOf(job) !== undefined ? job.output : yield* decodeFailure(queue.name, job.output);
					const sourceOutput = job.sourceOutput === null ? null : yield* decodeFailure(queue.name, job.sourceOutput);
					return Option.some({ ...job, data: redact(data), output, sourceOutput });
				}),
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
