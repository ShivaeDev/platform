import { type DateTime, Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { inspection } from "#server/adapters/inspection.ts";
import type { inspectionChanges } from "#server/adapters/inspectionChanges.ts";
import type { inspectionReads } from "#server/adapters/inspectionReads.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";
import { PgBoss } from "#server/PgBoss.ts";
import type { PgBossService } from "#server/service.ts";

export type SnapshotQueue = Pick<QueueDefinition<string, JobPayloadSchema>, "name" | "schema">;

export interface UnfinishedJob<TQueue extends SnapshotQueue> {
	readonly data: TQueue["schema"]["Type"];
	readonly id: string;
	readonly queue: TQueue["name"];
	readonly startAfter: DateTime.Utc;
	readonly state: "active" | "created" | "deferred" | "failed" | "retry";
}

export const PgBossInspection = defineService({
	id: "@shivaedev/jobs/PgBossInspection",
	initialize: Effect.gen(function* () {
		const acquired = yield* PgBoss;
		return yield* inspection(acquired.client, acquired.schema);
	}),
	methods: (service) => ({
		busy: service.busy,
		changes: service.changes,
		counts: service.counts,
		deadLetteredJobs: genericMethod(service.deadLetteredJobs),
		deferred: service.deferred,
		failedJobs: genericMethod(service.failedJobs),
		getJob: genericMethod(service.getJob),
		health: service.health,
		jobs: genericMethod(service.jobs),
		queue: service.queue,
		schedules: service.schedules,
		schemaVersion: service.schemaVersion,
		snapshot: genericMethod(service.snapshot),
		storedJobs: service.storedJobs,
	}),
	requires: [PgBoss] as const,
});

export type PgBossInspectionService = ReturnType<typeof inspectionReads> &
	Pick<PgBossService, "counts" | "deadLetteredJobs" | "failedJobs" | "getJob"> & {
		readonly health: (queues: readonly { readonly name: string }[]) => ReturnType<PgBossService["health"]>;
		readonly changes: (queue?: { readonly name: string }) => ReturnType<typeof inspectionChanges>;
	};
