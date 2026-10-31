import { sweepExpiredSessions } from "@shivaedev/identity/server/better-auth/sweepExpiredSessions.ts";
import { defineSchedule } from "@shivaedev/jobs/server/defineSchedule.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { sessionSweep } from "#sessionSweep.ts";

export const SweepExpiredSessions = defineSchedule({
	cron: "0 0 * * *",
	name: sessionSweep.name,
	schedule: { tz: "UTC" },
});

const FoundationJobs = makePgBoss("app/FoundationJobs", [sessionSweep.name]);

export const foundationWorker = FoundationJobs.layer({
	jobs: [SweepExpiredSessions.run(sweepExpiredSessions)],
});
