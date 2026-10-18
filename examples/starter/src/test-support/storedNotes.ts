import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Note } from "#notes.ts";

interface StoredNote extends Note {
	readonly ownerId: string | null;
}

export function storedNotes(tell: (line: string) => void) {
	return {
		storedNoteOwners: Effect.fn("AppStory.storedNoteOwners")(function* (title: string) {
			tell(`read the stored owner of ${JSON.stringify(title)}`);
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ ownerId: string | null }>`select "ownerId" from notes where title = ${title}`;
		}),
		storedNotes: Effect.fn("AppStory.storedNotes")(function* () {
			tell("read the independently stored notes");
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<StoredNote>`select id, title, version, "wordCount", "ownerId" from notes order by id`;
		}),
	};
}
