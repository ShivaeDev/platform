import { Effect, Redacted } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { notes } from "#modules/notes/notes.ts";
import { CountWords, NoteJobs } from "./jobs.ts";
import { makeNotesRepository } from "./makeRepository.ts";

const countWords = CountWords.handle(({ noteId }) =>
	Effect.gen(function* () {
		const repository = yield* makeNotesRepository;
		const rows = yield* repository.findMany({ where: { id: noteId, wordCount: null } });
		for (const row of rows) {
			yield* repository.update({ ...row, wordCount: row.title.split(/\s+/u).length });
			yield* invalidateOnCommit(invalidationKeys([notes.item(row.id), ...(row.ownerId === null ? [] : [notes.bucket.userId(row.ownerId)])]));
		}
	}).pipe(transact({ onSqlError: (error) => error }), Effect.withSpan("CountWords", { kind: "consumer" })),
);

export function notesWorker(url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) {
	return NoteJobs.layer({
		...(max === undefined ? {} : { max }),
		...(clientFactory === undefined ? {} : { clientFactory }),
		connectionString: Redacted.value(url),
		jobs: [countWords],
		migrate: false,
		stop: { graceful: true, timeout: 65_000 },
	});
}
