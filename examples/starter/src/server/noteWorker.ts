import { Config, Effect, Layer, Redacted } from "effect";
import { invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { appDatabase } from "@shivaedev/platform/appHost.ts";
import { notes } from "#notes.ts";
import { authDatabase } from "./authDatabase.ts";
import { databaseOptions } from "./databaseOptions.ts";
import { makeNotesRepository } from "./makeNotesRepository.ts";
import { CountWords, NoteJobs } from "./noteJobs.ts";

const countWords = CountWords.handle(({ noteId }) =>
	Effect.gen(function* () {
		const repository = yield* makeNotesRepository;
		const rows = yield* repository.findMany({ where: { id: noteId, wordCount: null } });
		for (const row of rows) {
			yield* repository.update({ ...row, wordCount: row.title.split(/\s+/u).length });
		}
		yield* invalidateOnCommit(invalidationKeys([notes.item(noteId)]));
	}).pipe(transact({ onSqlError: (error) => error })),
);

export function noteWorker(config?: { readonly databaseUrl?: Redacted.Redacted<string> }) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const pool = yield* authDatabase(databaseUrl);
			return NoteJobs.layer({ connectionString: Redacted.value(databaseUrl), jobs: [countWords], migrate: false }).pipe(
				Layer.tap(() => Effect.logInfo("Worker ready to take jobs")),
				Layer.provideMerge(appDatabase(databaseOptions(pool, databaseUrl)).pipe(Layer.tap(() => Effect.logInfo("Worker migrations applied")))),
			);
		}),
	);
}
