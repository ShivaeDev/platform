import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { CountWords, NoteJobs } from "#modules/notes/server/jobs.ts";

export function noteProducer(connectionString: string, clientFactory?: PgBossClientFactory, max?: number) {
	return NoteJobs.layer({
		...(max === undefined ? {} : { max }),
		...(clientFactory === undefined ? {} : { clientFactory }),
		connectionString,
		jobs: [CountWords],
		migrate: false,
	});
}
