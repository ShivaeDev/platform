import type { DateTime } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import type { inspectionChanges } from "#server/adapters/inspectionChanges.ts";
import type { inspectionReads } from "#server/adapters/inspectionReads.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";
import { initializeInspection } from "#server/internal/initializeInspection.ts";
import { busy } from "#server/internal/operations/busy.ts";
import { changes } from "#server/internal/operations/changes.ts";
import { counts } from "#server/internal/operations/counts.ts";
import { deadLetteredJobs } from "#server/internal/operations/deadLetteredJobs.ts";
import { deferred } from "#server/internal/operations/deferred.ts";
import { failedJobs } from "#server/internal/operations/failedJobs.ts";
import { getJob } from "#server/internal/operations/getJob.ts";
import { inspectionHealth } from "#server/internal/operations/inspectionHealth.ts";
import { jobs } from "#server/internal/operations/jobs.ts";
import { queue } from "#server/internal/operations/queue.ts";
import { schedules } from "#server/internal/operations/schedules.ts";
import { schemaVersion } from "#server/internal/operations/schemaVersion.ts";
import { snapshot } from "#server/internal/operations/snapshot.ts";
import { storedJobs } from "#server/internal/operations/storedJobs.ts";
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
