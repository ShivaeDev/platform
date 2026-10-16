import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"enqueues committed notes through the producer and refetches the live client after worker updates",
	[signedIn()],
	function* ({ actor, startWorker, liveNotes }) {
		const sql = yield* SqlClient.SqlClient;
		const { notes: http } = actor();
		const { list, registry } = yield* liveNotes();
		const note = yield* http.create({ title: "Count these three words" });
		expect(note.wordCount).toBeNull();
		yield* Effect.promise(() => vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(list), () => [])).toEqual([note])));
		expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count: 1 }]);
		yield* Effect.sleep("1200 millis");
		expect(yield* sql`select "wordCount" from starter_notes where id = ${note.id}`).toEqual([{ wordCount: null }]);
		yield* startWorker();
		yield* Effect.promise(() =>
			vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(list), () => [])).toEqual([{ ...note, version: 1, wordCount: 4 }]), {
				timeout: 5000,
			}),
		);
		const second = yield* http.create({ title: "After commit" });
		yield* Effect.promise(() =>
			vi.waitFor(
				() =>
					expect(AsyncResult.getOrElse(registry.get(list), () => [])).toEqual([
						{ id: second.id, title: second.title, version: 1, wordCount: 2 },
						{ ...note, version: 1, wordCount: 4 },
					]),
				{ timeout: 5000 },
			),
		);
		const completed = sql`select state, retry_count as "retryCount" from pgboss.job where name = 'count-note-words' order by created_on`;
		yield* Effect.promise(() =>
			vi.waitFor(
				async () =>
					expect(await Effect.runPromise(completed)).toEqual([
						{ retryCount: 0, state: "completed" },
						{ retryCount: 0, state: "completed" },
					]),
				{ timeout: 5000 },
			),
		);
		expect(yield* sql`select count(*)::int as count from starter_notes`).toEqual([{ count: 2 }]);
	},
	15_000,
);
