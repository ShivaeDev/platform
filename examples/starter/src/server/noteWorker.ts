import { Config, Effect, Layer, Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { appDatabase } from "@shivaedev/platform/appHost.ts";
import { notes } from "#notes.ts";
import { makeAuth } from "./auth.ts";
import { databaseOptions } from "./databaseOptions.ts";
import { CountWords, NoteJobs } from "./noteJobs.ts";

const countWords = CountWords.handle(({ noteId }) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql<{ title: string }>`select title from starter_notes where id = ${noteId} and "wordCount" is null`;
		for (const row of rows) {
			yield* sql`update starter_notes set "wordCount" = ${row.title.split(/\s+/u).length} where id = ${noteId} and "wordCount" is null`;
		}
		yield* invalidateOnCommit(invalidationKeys([notes.item(noteId)]));
	}).pipe(transact({ onSqlError: (error) => error })),
);

export function noteWorker(config?: { readonly databaseUrl?: Redacted.Redacted<string>; readonly secret?: Redacted.Redacted<string> }) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.redacted("DATABASE_URL"));
			const { auth } = yield* makeAuth({ databaseUrl, ...(config?.secret === undefined ? {} : { secret: config.secret }) });
			return NoteJobs.layer({ connectionString: Redacted.value(databaseUrl), jobs: [countWords] }).pipe(
				Layer.provideMerge(appDatabase(databaseOptions(auth, databaseUrl))),
			);
		}),
	);
}
