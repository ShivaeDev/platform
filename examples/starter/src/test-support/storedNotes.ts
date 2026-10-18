import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import type { Note } from "#notes.ts";

interface StoredNote extends Note {
	readonly ownerId: string | null;
}

export function storedNotes(tell: (line: string) => void) {
	const read = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* sql<StoredNote>`select id, title, version, "wordCount", "ownerId" from notes order by id`;
	});
	const storedNotesAre = Effect.fn("AppStory.storedNotesAre")(function* (expected: readonly Partial<StoredNote>[]) {
		tell("check the independently stored notes");
		expect(yield* read).toEqual(expected.map((note) => expect.objectContaining(note)));
	});
	return {
		noJobsAreStored: Effect.gen(function* () {
			tell("check that PostgreSQL stores no jobs");
			const sql = yield* SqlClient.SqlClient;
			expect(yield* sql`select count(*)::int as count from pgboss.job`).toEqual([{ count: 0 }]);
		}),
		storedNoteOwnerIs: Effect.fn("AppStory.storedNoteOwnerIs")(function* (title: string, ownerId: string | null) {
			tell(`check the stored owner of ${JSON.stringify(title)}`);
			const sql = yield* SqlClient.SqlClient;
			expect(yield* sql`select "ownerId" from notes where title = ${title}`).toEqual([{ ownerId }]);
		}),
		storedNotes: () => read,
		storedNotesAre,
		storedWordCountIs: Effect.fn("AppStory.storedWordCountIs")(function* (id: number, wordCount: number | null) {
			tell(`wait for note ${id} to store word count ${wordCount}`);
			const sql = yield* SqlClient.SqlClient;
			yield* Effect.promise(() =>
				vi.waitFor(
					async () => {
						expect(await Effect.runPromise(sql`select "wordCount" from notes where id = ${id}`)).toEqual([{ wordCount }]);
					},
					{ timeout: 8000 },
				),
			);
		}),
		wordCountJobsAre: Effect.fn("AppStory.wordCountJobsAre")(function* (count: number) {
			tell(`check that PostgreSQL stores ${count} word-count jobs`);
			const sql = yield* SqlClient.SqlClient;
			expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count }]);
		}),
		wordCountJobsComplete: Effect.fn("AppStory.wordCountJobsComplete")(function* (count: number) {
			tell(`wait for ${count} word-count jobs to complete without retries`);
			const sql = yield* SqlClient.SqlClient;
			const completed = sql`select state, retry_count as "retryCount" from pgboss.job where name = 'count-note-words' order by created_on`;
			const expected = Array.from({ length: count }, () => ({ retryCount: 0, state: "completed" }));
			yield* Effect.promise(() => vi.waitFor(async () => expect(await Effect.runPromise(completed)).toEqual(expected), { timeout: 8000 }));
		}),
		wordCountRemainsPending: Effect.fn("AppStory.wordCountRemainsPending")(function* (note: Note) {
			tell("wait past the worker's polling interval without a worker");
			yield* Effect.sleep("1200 millis");
			yield* storedNotesAre([note]);
		}),
	};
}
