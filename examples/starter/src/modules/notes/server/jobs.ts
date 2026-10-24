import { Schema } from "effect";
import { defineQueue } from "@shivaedev/effect-pg-boss/server/definition.ts";
import { makePgBoss } from "@shivaedev/effect-pg-boss/server/service.ts";

export const CountWords = defineQueue({
	name: "count-note-words",
	schema: Schema.Struct({ noteId: Schema.Number }),
	worker: { pollingIntervalSeconds: 1 },
});

export const NoteJobs = makePgBoss("app/NoteJobs");
