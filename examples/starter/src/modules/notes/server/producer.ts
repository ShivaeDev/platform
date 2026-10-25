import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { CountWords, NoteJobs } from "#modules/notes/server/jobs.ts";

export function noteProducer(connectionString: string, clientFactory?: PgBossClientFactory) {
	return NoteJobs.layer({ ...(clientFactory === undefined ? {} : { clientFactory }), connectionString, jobs: [CountWords], migrate: false });
}
