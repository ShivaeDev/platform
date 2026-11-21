import { Layer } from "effect";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { migrationsIn } from "@shivaedev/server/migrationsIn.ts";
import { Notes } from "#modules/notes/Notes.ts";
import { adminRegistration } from "#modules/notes/server/admin/registration.ts";
import { jsonPlaceholderNotes } from "#modules/notes/server/jsonPlaceholder.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { notesWorker } from "#modules/notes/server/worker.ts";

export const notesRegistration = {
	admin: adminRegistration,
	migrations: migrationsIn(import.meta.dirname),
	module: Notes,
	ports: Layer.merge(jsonPlaceholderNotes, noteProducer),
	queues: notesWorker.queues,
	services: NotesRepository.layer,
	workers: notesWorker.workers,
} satisfies AppModule;
