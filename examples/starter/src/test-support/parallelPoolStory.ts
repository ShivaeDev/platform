import process from "node:process";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

export function parallelPoolStory() {
	app.it("closes the host, auth pool and job worker before dropping the story database", [signedIn()], function* ({ actor, startWorker }, context) {
		yield* Effect.promise(() => context.annotate(String(process.pid), "worker"));
		yield* startWorker();
		const note = yield* actor().notes.create({ title: "Count these words" });
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.promise(() =>
			vi.waitFor(
				async () => {
					expect(await Effect.runPromise(sql`select "wordCount" from notes where id = ${note.id}`)).toEqual([{ wordCount: 3 }]);
				},
				{ timeout: 8000 },
			),
		);
	});
}
