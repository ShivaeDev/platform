import { type Context, Effect } from "effect";
import type { PgBossClient } from "#server/adapters/client.ts";
import { listJobs } from "#server/adapters/listJobs.ts";
import { queueAdministration } from "#server/adapters/queueAdministration.ts";
import { runScheduleNow } from "#server/adapters/runScheduleNow.ts";
import { settleDeferral } from "#server/adapters/settleDeferral.ts";
import type { JobEngine } from "#server/engine.ts";
import { toPgBossError } from "#server/error.ts";

export function jobEngine(client: PgBossClient, schema = "pgboss"): Context.Service.Shape<typeof JobEngine> {
	return {
		...queueAdministration(client),
		getJob: (queue, id) =>
			Effect.tryPromise({
				catch: (error) => toPgBossError("getJob", error, queue),
				try: async () => {
					if (client.findJobs === undefined) {
						throw new TypeError("This pg-boss client does not support findJobs");
					}
					return (await client.findJobs(queue, { id }))[0];
				},
			}),
		listJobs: listJobs(client, schema),
		retry: (queue, id) =>
			Effect.tryPromise({
				catch: (error) => toPgBossError("retry", error, queue),
				try: async () => {
					if (client.findJobs === undefined || client.retry === undefined || client.update === undefined) {
						throw new TypeError("This pg-boss client does not support findJobs, retry and update");
					}
					const job = (await client.findJobs(queue, { id }))[0];
					if (job?.state !== "failed" && job?.state !== "retry") {
						return;
					}
					if (job.state === "failed") {
						await client.retry(queue, id);
					}
					await client.update(queue, undefined, { id, startAfter: 0 });
				},
			}),
		runScheduleNow: (schedule) => runScheduleNow(client, schedule),
		settleDeferral: (job, at, reason, maxDeferrals) =>
			Effect.tryPromise({
				catch: (error) => toPgBossError("settle", error, job.name),
				try: () => settleDeferral(client, schema, job, at, reason, maxDeferrals),
			}).pipe(
				Effect.tap((settled) =>
					Effect.sync(() => {
						if (!settled.claimed || settled.deferred) {
							// Native batch settlement must not match a sibling's new claim at the unchanged retry count.
							job.retryCount = Number.MAX_SAFE_INTEGER;
						}
					}),
				),
			),
	};
}
