import { Schema } from "effect";
import { defineQueue } from "@shivaedev/effect-pg-boss/definition.ts";
import { makePgBoss } from "@shivaedev/effect-pg-boss/service.ts";

export const CountWords = defineQueue({
	name: "count-note-words",
	queue: { retryBackoff: true, retryLimit: 3 },
	schema: Schema.Struct({ noteId: Schema.Number }),
	worker: { pollingIntervalSeconds: 1 },
});

export const NoteJobs = makePgBoss("starter/NoteJobs");
