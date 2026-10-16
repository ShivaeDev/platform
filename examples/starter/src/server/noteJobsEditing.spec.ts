import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"counts the edited title through the versioned repository and completes jobs for deleted notes",
	[signedIn()],
	function* ({ actor, startWorker }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Old title" });
		const edited = yield* client.update({ ...original, title: "Three new words" });
		expect(edited.wordCount).toBeNull();
		const deleted = yield* client.create({ title: "Deleted before counting" });
		yield* client.delete({ id: deleted.id, version: deleted.version });
		yield* startWorker();
		const counted = { ...edited, version: 2, wordCount: 3 };
		yield* Effect.promise(() =>
			vi.waitFor(
				async () => {
					expect(await Effect.runPromise(client.get({ id: edited.id }))).toEqual(counted);
				},
				{ timeout: 5000 },
			),
		);
		const stale = yield* client.update({ ...edited, title: "Before counting" }).pipe(Effect.result);
		expect(Result.isFailure(stale) && stale.failure._tag).toBe("Conflict");
		expect(yield* client.list()).toEqual([counted]);
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.promise(() =>
			vi.waitFor(
				async () => {
					expect(await Effect.runPromise(sql`select state from pgboss.job where name = 'count-note-words'`)).toEqual([
						{ state: "completed" },
						{ state: "completed" },
						{ state: "completed" },
					]);
				},
				{ timeout: 5000 },
			),
		);
	},
	15_000,
);
