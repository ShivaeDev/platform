import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { CountWords, NoteJobs } from "#modules/notes/server/jobs.ts";

export function noteProducer(connectionString: string, clientFactory?: PgBossClientFactory, max?: number, clientCacheKey?: symbol) {
	return NoteJobs.layer({
		...(clientCacheKey === undefined ? {} : { clientCacheKey }),
		...(max === undefined ? {} : { max }),
		...(clientFactory === undefined ? {} : { clientFactory }),
		connectionString,
		jobs: [CountWords],
		migrate: false,
	});
}
