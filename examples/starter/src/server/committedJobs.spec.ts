import { Effect, Result } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { app, signedIn } from "#test-support/application.ts";
import { NotesService } from "./NotesService.ts";

app.it(
	"runs committed jobs once through the worker database and refetches the live client, while rollback discards a job",
	[signedIn()],
	function* ({ actor, runningHost, startWorker, liveNotes }) {
		const sql = yield* SqlClient.SqlClient;
		const { context } = runningHost();
		const { notes: http } = actor();
		const { list, registry } = yield* liveNotes();
		const note = yield* http.create({ title: "Count these three words" });
		expect(note.wordCount).toBeNull();
		yield* Effect.promise(() => vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(list), () => [])).toEqual([note])));
		const users = yield* sql<{ id: string }>`select id from "user" where email = 'alice@starter.test'`;
		const ownerId = users[0]?.id;
		if (ownerId === undefined) {
			return yield* Effect.die("Missing account");
		}
		const rollback = yield* Effect.gen(function* () {
			const service = yield* NotesService;
			yield* service.create({ title: "Rolled back" }, ownerId);
			return yield* Effect.fail("rollback");
		}).pipe(transact({ onSqlError: (error) => error }), Effect.provide(context), Effect.result);
		expect(Result.isFailure(rollback) && rollback.failure).toBe("rollback");
		expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count: 1 }]);
		yield* Effect.sleep("1200 millis");
		expect(yield* sql`select "wordCount" from starter_notes where id = ${note.id}`).toEqual([{ wordCount: null }]);
		yield* startWorker();
		yield* Effect.promise(() =>
			vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(list), () => [])).toEqual([{ ...note, version: 1, wordCount: 4 }]), {
				timeout: 5000,
			}),
		);
		const second = yield* Effect.gen(function* () {
			const service = yield* NotesService;
			const pending = yield* service.create({ title: "After commit" }, ownerId);
			expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count: 1 }]);
			yield* Effect.sleep("1200 millis");
			const transactionSql = yield* SqlClient.SqlClient;
			expect(yield* transactionSql`select "wordCount" from starter_notes where id = ${pending.id}`).toEqual([{ wordCount: null }]);
			return pending;
		}).pipe(transact({ onSqlError: (error) => error }), Effect.provide(context));
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
