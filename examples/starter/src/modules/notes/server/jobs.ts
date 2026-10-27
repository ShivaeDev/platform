import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { noteQueue } from "#modules/notes/queue.ts";

export const CountWords = defineQueue({
	...noteQueue,
	queue: { expireInSeconds: 60 },
	worker: { pollingIntervalSeconds: 1 },
});

export const NoteJobs = makePgBoss("app/NoteJobs");
