import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { InspectionEngine } from "#server/InspectionEngine.ts";
import { PgBoss } from "#server/PgBoss.ts";
import { busy } from "#server/services/inspection/busy.ts";
import { changes } from "#server/services/inspection/changes.ts";
import { counts } from "#server/services/inspection/counts.ts";
import { deferred } from "#server/services/inspection/deferred.ts";
import { health } from "#server/services/inspection/health.ts";
import { queue } from "#server/services/inspection/queue.ts";
import { schedules } from "#server/services/inspection/schedules.ts";
import { schemaVersion } from "#server/services/inspection/schemaVersion.ts";
import { snapshot } from "#server/services/inspection/snapshot.ts";
import { storedJobs } from "#server/services/inspection/storedJobs.ts";
export const PgBossInspectionReads = defineService({
	id: "@shivaedev/jobs/PgBossInspectionReads",
	initialize: Effect.void,
	methods: () => ({ busy, changes, counts, deferred, health, queue, schedules, schemaVersion, snapshot, storedJobs }),
	requires: [PgBoss, InspectionEngine],
});
