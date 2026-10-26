import { Effect, Option } from "effect";
import type { JobWithMetadata, PgBoss } from "pg-boss";
import { eventually } from "@shivaedev/test/eventually.ts";
import type { JobPayloadSchema, QueueDefinition } from "#definition.ts";
import type { PgBossService } from "#service.ts";

export function waitingVerbs() {
	function until<A, E, R>(read: Effect.Effect<A, E, R>, ready: (value: A) => boolean, timeout = 15_000) {
		return eventually(read.pipe(Effect.filterOrFail(ready)), { interval: 50 }).pipe(Effect.timeout(timeout));
	}
	return {
		until,
		untilJob: <const TPayload extends JobPayloadSchema>(
			jobs: PgBossService,
			queue: QueueDefinition<string, TPayload>,
			id: string,
			state: JobWithMetadata<unknown>["state"],
			timeout = 15_000,
		) => until(jobs.getJob(queue, id), (found) => Option.getOrUndefined(found)?.state === state, timeout).pipe(Effect.map(Option.getOrThrow)),
		untilJobs: <TPayload = unknown>(client: PgBoss, name: string, ready: (jobs: JobWithMetadata<TPayload>[]) => boolean, timeout = 15_000) =>
			until(
				Effect.promise(() => client.findJobs<TPayload>(name)),
				ready,
				timeout,
			),
		untilWorker: (client: PgBoss, name: string) =>
			until(
				Effect.sync(() => client.getWipData().find((worker) => worker.name === name && worker.lastFetchedOn !== null)),
				(worker) => worker !== undefined,
			),
	};
}
