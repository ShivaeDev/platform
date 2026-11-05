import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { InspectionEngine } from "#server/InspectionEngine.ts";
import { PgBoss } from "#server/PgBoss.ts";
import { busy } from "./busy.ts";
import { changes } from "./changes.ts";
import { counts } from "./counts.ts";
import { deferred } from "./deferred.ts";
import { health } from "./health.ts";
import { queue } from "./queue.ts";
import { schedules } from "./schedules.ts";
import { schemaVersion } from "./schemaVersion.ts";
import { snapshot } from "./snapshot.ts";
import { storedJobs } from "./storedJobs.ts";
export const PgBossInspectionReads = defineService({
	id: "@shivaedev/jobs/PgBossInspectionReads",
	initialize: Effect.void,
	methods: () => ({ busy, changes, counts, deferred, health, queue, schedules, schemaVersion, snapshot, storedJobs }),
	requires: [PgBoss, InspectionEngine],
});
