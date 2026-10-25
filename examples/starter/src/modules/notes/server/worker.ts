import { Effect, Redacted } from "effect";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { CountWords, NoteJobs } from "./jobs.ts";
import { makeNotesRepository } from "./makeRepository.ts";

const countWords = CountWords.handle(({ noteId }) =>
	Effect.gen(function* () {
		const repository = yield* makeNotesRepository;
		const rows = yield* repository.findMany({ where: { id: noteId, wordCount: null } });
		for (const row of rows) {
			yield* repository.update({ ...row, wordCount: row.title.split(/\s+/u).length });
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
	});
}
