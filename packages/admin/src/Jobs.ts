import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { adminJobsWire } from "#generated/Jobs.ts";
import { JobsPermission } from "#permissions.ts";
import { Counts, DeadLettered, Detail, Failed, Health, Running } from "#server/jobsReads.ts";

export const Jobs = defineModule({
	middleware: JobsPermission,
	name: "admin.jobs",
	operations: [Health, Counts, Running, Failed, DeadLettered, Detail],
	wire: adminJobsWire,
});
