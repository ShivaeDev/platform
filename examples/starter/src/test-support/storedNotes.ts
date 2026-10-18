import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Note } from "#notes.ts";

interface StoredNote extends Note {
	readonly ownerId: string | null;
}

export function storedNotes(tell: (line: string) => void) {
	return {
		storedNoteOwners: Effect.fn("AppStory.storedNoteOwners")(function* (title: string) {
			tell(`read the stored owners of ${JSON.stringify(title)}`);
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ ownerId: string | null }>`select "ownerId" from notes where title = ${title}`;
		}),
		storedNotes: Effect.fn("AppStory.storedNotes")(function* () {
			tell("read the independently stored notes");
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<StoredNote>`select id, title, version, "wordCount", "ownerId" from notes order by id`;
		}),
		storedWordCounts: Effect.fn("AppStory.storedWordCounts")(function* (id: number) {
			tell(`read the stored word count of note ${id}`);
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ wordCount: number | null }>`select "wordCount" from notes where id = ${id}`;
		}),
		waitPastWorkerPoll: Effect.fn("AppStory.waitPastWorkerPoll")(function* () {
			tell("wait past the worker's polling interval without a worker");
			yield* Effect.sleep("1200 millis");
		}),
		wordCountJobs: Effect.fn("AppStory.wordCountJobs")(function* () {
			tell("read the independently stored word-count jobs");
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{
				state: string;
				retryCount: number;
			}>`select state, retry_count as "retryCount" from pgboss.job where name = 'count-note-words' order by created_on`;
		}),
	};
}
