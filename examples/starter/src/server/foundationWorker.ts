import { Redacted } from "effect";
import { sweepExpiredSessions } from "@shivaedev/identity/server/better-auth/sweepExpiredSessions.ts";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { defineSchedule } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";

export const SweepExpiredSessions = defineSchedule({
	cron: "0 0 * * *",
	name: "sweep-expired-auth-sessions",
	schedule: { tz: "UTC" },
});

const FoundationJobs = makePgBoss("app/FoundationJobs");

export function foundationWorker(url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number, clientCacheKey?: symbol) {
	return FoundationJobs.layer({
		...(max === undefined ? {} : { max }),
		...(clientFactory === undefined ? {} : { clientFactory }),
		...(clientCacheKey === undefined ? {} : { clientCacheKey }),
		connectionString: Redacted.value(url),
		jobs: [SweepExpiredSessions.run(sweepExpiredSessions)],
		migrate: false,
		stop: { graceful: true, timeout: 65_000 },
	});
}
