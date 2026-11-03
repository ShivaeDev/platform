import { Effect, type Schema } from "effect";
import type { JobReadOptions, PgBossClient } from "#server/client.ts";
import type { JobPayloadSchema } from "#server/definition.ts";
import { toPgBossError } from "#server/error.ts";
import { decodeStoredData } from "#server/internal/storedRows.ts";

export function inspectionJobs(client: PgBossClient) {
	function storedJobs(queue: { readonly name: string }, options?: JobReadOptions) {
		return Effect.tryPromise({
			catch: (error) => toPgBossError("inspect", error, queue.name),
			try: () => {
				if (client.findJobs === undefined) {
					throw new TypeError("This pg-boss client does not support findJobs");
				}
				return client.findJobs(queue.name, options);
			},
		});
	}
	function jobs<TName extends string, TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options?: JobReadOptions,
	) {
		return storedJobs(queue, options).pipe(
			Effect.flatMap((rows) => Effect.forEach(rows, (job) => decodeStoredData(queue, job.data).pipe(Effect.map((data) => ({ ...job, data }))))),
		);
	}
	return { jobs, storedJobs };
}
