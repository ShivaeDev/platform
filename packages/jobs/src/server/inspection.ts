import type { DateTime, Effect, Schema } from "effect";
import { Context } from "effect";
import type { JobReadOptions } from "#server/adapters/client.ts";
import type { inspectionChanges } from "#server/adapters/inspectionChanges.ts";
import type { inspectionReads } from "#server/adapters/inspectionReads.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";
import type { PgBossError, PgBossPayloadError } from "#server/error.ts";
import { inspectionLayer } from "#server/inspectionLayer.ts";
import type { Job } from "#server/job.ts";
import type { PgBossService } from "#server/service.ts";

export type SnapshotQueue = Pick<QueueDefinition<string, JobPayloadSchema>, "name" | "schema">;

export interface UnfinishedJob<TQueue extends SnapshotQueue> {
	readonly data: TQueue["schema"]["Type"];
	readonly id: string;
	readonly queue: TQueue["name"];
	readonly startAfter: DateTime.Utc;
	readonly state: "active" | "created" | "deferred" | "failed" | "retry";
}

export type PgBossInspectionService = Omit<ReturnType<typeof inspectionReads>, "snapshot"> & {
	readonly jobs: <TName extends string, TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options?: JobReadOptions,
	) => Effect.Effect<Job<TPayload["Type"]>[], PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly snapshot: <const TQueues extends readonly SnapshotQueue[]>(
		queues: TQueues,
	) => Effect.Effect<readonly UnfinishedJob<TQueues[number]>[], PgBossPayloadError | PgBossError, TQueues[number]["schema"]["DecodingServices"]>;
} & Pick<PgBossService, "counts" | "deadLetteredJobs" | "failedJobs" | "getJob"> & {
		readonly health: (queues: readonly { readonly name: string }[]) => ReturnType<PgBossService["health"]>;
		readonly changes: (queue?: { readonly name: string }) => ReturnType<typeof inspectionChanges>;
	};

const Inspection = Context.Service<"@shivaedev/jobs/PgBossInspection", PgBossInspectionService>("@shivaedev/jobs/PgBossInspection");
export const PgBossInspection = Object.assign(Inspection, { layer: inspectionLayer(Inspection) });
