import { defineQueue } from "@shivaedev/effect-pg-boss/server/definition.ts";
import { makePgBoss } from "@shivaedev/effect-pg-boss/server/service.ts";
import { noteQueue } from "#modules/notes/queue.ts";

export const CountWords = defineQueue({
	...noteQueue,
	queue: { expireInSeconds: 60 },
	worker: { pollingIntervalSeconds: 1 },
});

export const NoteJobs = makePgBoss("app/NoteJobs");
