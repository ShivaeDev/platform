import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { clientOptions } from "@shivaedev/effect-sql/clientOptions.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import type { Note } from "#modules/notes/notes.ts";

interface StoredNote extends Note {
	readonly ownerId: string | null;
}

function read<A, E>(query: Effect.Effect<A, E, SqlClient.SqlClient>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			return yield* query.pipe(Effect.provide(PgClient.layer(clientOptions({ url: database.url }))));
		}),
	);
}

export function storedNotes(tell: (line: string) => void) {
	return {
		storedNoteOwners: Effect.fn("AppStory.storedNoteOwners")(function* (title: string) {
			tell(`read the stored owner of ${JSON.stringify(title)}`);
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ ownerId: string | null }>`select owner_id from notes where title = ${title}`;
		}, read),
		storedNotes: Effect.fn("AppStory.storedNotes")(function* () {
			tell("read the independently stored notes");
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<StoredNote>`select id, title, version, word_count, owner_id from notes order by id`;
		}, read),
	};
}
