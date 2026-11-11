import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { adminJobsWire } from "#generated/Jobs.ts";
import { JobsPermission } from "#permissions.ts";
import { Counts, DeadLettered, Detail, Failed, Health } from "#server/jobsReads.ts";
import { RegisteredQueues } from "#server/RegisteredQueues.ts";

export const Jobs = defineModule({
	middleware: JobsPermission,
	name: "admin.jobs",
	operations: [Health, Counts, Failed, DeadLettered, Detail],
	requires: [RegisteredQueues],
	wire: adminJobsWire,
});
