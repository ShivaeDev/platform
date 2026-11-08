import { Effect } from "effect";
import type { JobReadOptions, PgBossClient } from "#server/adapters/client.ts";
import { toPgBossError } from "#server/error.ts";

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
	return { storedJobs };
}
