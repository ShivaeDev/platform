import type { DateTime } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import type { inspectionChanges } from "#server/adapters/inspectionChanges.ts";
import type { inspectionReads } from "#server/adapters/inspectionReads.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";
import { initializeInspection } from "#server/initializeInspection.ts";
import { busy } from "#server/operations/busy.ts";
import { changes } from "#server/operations/changes.ts";
import { counts } from "#server/operations/counts.ts";
import { deadLetteredJobs } from "#server/operations/deadLetteredJobs.ts";
import { deferred } from "#server/operations/deferred.ts";
import { failedJobs } from "#server/operations/failedJobs.ts";
import { getJob } from "#server/operations/getJob.ts";
import { inspectionHealth } from "#server/operations/inspectionHealth.ts";
import { jobs } from "#server/operations/jobs.ts";
import { queue } from "#server/operations/queue.ts";
import { schedules } from "#server/operations/schedules.ts";
import { schemaVersion } from "#server/operations/schemaVersion.ts";
import { snapshot } from "#server/operations/snapshot.ts";
import { storedJobs } from "#server/operations/storedJobs.ts";
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
	initialize: initializeInspection,
	methods: (service) => ({
		busy: busy(service),
		changes: changes(service),
		counts: counts(service),
		deadLetteredJobs: genericMethod(deadLetteredJobs(service)),
		deferred: deferred(service),
		failedJobs: genericMethod(failedJobs(service)),
		getJob: genericMethod(getJob(service)),
		health: inspectionHealth(service),
		jobs: genericMethod(jobs(service)),
		queue: queue(service),
		schedules: schedules(service),
		schemaVersion: schemaVersion(service),
		snapshot: genericMethod(snapshot(service)),
		storedJobs: storedJobs(service),
	}),
	requires: [PgBoss] as const,
});

export type PgBossInspectionService = ReturnType<typeof inspectionReads> &
	Pick<PgBossService, "counts" | "deadLetteredJobs" | "failedJobs" | "getJob"> & {
		readonly health: (queues: readonly { readonly name: string }[]) => ReturnType<PgBossService["health"]>;
		readonly changes: (queue?: { readonly name: string }) => ReturnType<typeof inspectionChanges>;
	};
