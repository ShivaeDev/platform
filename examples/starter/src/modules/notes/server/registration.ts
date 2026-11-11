import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Path } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { Notes } from "#modules/notes/Notes.ts";
import { jsonPlaceholderNotes } from "#modules/notes/server/adapters/jsonPlaceholder.ts";
import { adminRegistration } from "#modules/notes/server/admin/registration.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { notesWorker } from "#modules/notes/server/worker.ts";

export const notesRegistration = {
	admin: adminRegistration,
	migrations: {
		loader: Effect.flatMap(Path.Path, (path) => MigratorFileSystem.fromFileSystem(path.join(import.meta.dirname, "migrations"))).pipe(
			Effect.provide(NodeServices.layer),
		),
	},
	module: Notes,
	name: "notes",
	ports: Layer.mergeAll(jsonPlaceholderNotes, memoryStore, noteProducer),
	queues: notesWorker.queues,
	services: NotesRepository.layer,
	workers: notesWorker.workers,
} satisfies AppModule;
