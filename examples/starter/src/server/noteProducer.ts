import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/client.ts";
import { CountWords, NoteJobs } from "#server/noteJobs.ts";

export function noteProducer(connectionString: string, migrate = false, clientFactory?: PgBossClientFactory) {
	return NoteJobs.layer({ ...(clientFactory === undefined ? {} : { clientFactory }), connectionString, jobs: [CountWords], migrate });
}
