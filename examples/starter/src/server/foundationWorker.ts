import { sweepExpiredSessions } from "@shivaedev/identity/server/better-auth/sweepExpiredSessions.ts";
import { defineSchedule } from "@shivaedev/jobs/server/defineSchedule.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";

export const SweepExpiredSessions = defineSchedule({
	cron: "0 0 * * *",
	name: "sweep-expired-auth-sessions",
	schedule: { tz: "UTC" },
});

const FoundationJobs = makePgBoss("app/FoundationJobs");

export const foundationWorker = FoundationJobs.layer({
	jobs: [SweepExpiredSessions.run(sweepExpiredSessions)],
});
