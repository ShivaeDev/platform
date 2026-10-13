import { Effect, Layer, Redacted, Result } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { SqlClient } from "effect/unstable/sql";
import { expect, vi } from "vitest";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { makeNotesClient } from "#client/makeNotes.ts";
import { authPost, credentials, notesHttp } from "#test-support/authHttp.ts";
import { effectApp } from "#test-support/postgres.ts";
import { NotesService } from "./NotesService.ts";
import { noteWorker } from "./noteWorker.ts";

effectApp(
	"runs committed jobs once through the worker database and refetches the live client, while rollback discards a job",
	function* ({ baseUrl, context }) {
		const sql = yield* SqlClient.SqlClient;
		const database = yield* PostgresTestDatabase;
		const cookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
		const http = yield* notesHttp(baseUrl, cookie);
		const client = makeNotesClient(`${baseUrl}/rpc`, (transport) =>
			HttpClient.mapRequest(transport, HttpClientRequest.setHeaders({ cookie, origin: baseUrl })),
		);
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(value) => Effect.sync(() => value.dispose()),
		);
		const list = client.api.list.query();
		registry.mount(list);
		registry.mount(client.connection);
		yield* Effect.promise(() => vi.waitFor(() => expect(registry.get(client.status).connection).toBe("live")));
		const note = yield* http["notes.create"]({ title: "Count these three words" });
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
		yield* Layer.build(noteWorker({ databaseUrl: database.url, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }));
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
