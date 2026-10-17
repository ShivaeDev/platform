import { CountWords, NoteJobs } from "#server/noteJobs.ts";

export function noteProducer(connectionString: string, migrate = false) {
	return NoteJobs.layer({ connectionString, jobs: [CountWords], migrate });
}
