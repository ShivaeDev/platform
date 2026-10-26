import { Effect } from "effect";
import { expect } from "vitest";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";

adminHost.it(
	"serves app statistics across owners and the registered job queue on the existing RPC host",
	[adminAccount("alice"), adminAccount("bob"), adminAccount("operator", "admin")],
	function* ({ createNote, openAdmin, startWorker }) {
		yield* createNote("alice", "Alice's note");
		yield* createNote("bob", "Bob's note");
		const client = yield* openAdmin("operator");
		expect(yield* client["admin.notes.statistics"]()).toEqual({ notes: 2, pending: 2, words: 0 });
		expect(yield* client["admin.jobs.counts"]({ queue: "count-note-words" })).toMatchObject({ queuedCount: 2, totalCount: 2 });
		const health = yield* client["admin.jobs.health"]();
		expect(health.jobs.map((queue) => queue.name)).toEqual(["count-note-words"]);
		yield* startWorker();
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(client["admin.notes.statistics"]()), { timeout: 8000 }).toEqual({ notes: 2, pending: 0, words: 4 }),
		);
	},
);

adminHost.it(
	"keeps both app admin pages forbidden to ordinary users and owners without admin",
	[adminAccount("reader"), adminAccount("owner", "owner")],
	function* ({ openAdmin }) {
		for (const name of ["reader", "owner", "visitor"]) {
			const client = yield* openAdmin(name);
			for (const query of [Effect.result(client["admin.notes.statistics"]()), Effect.result(client["admin.jobs.health"]())]) {
				const result = yield* query;
				expect(result._tag === "Failure" && result.failure._tag).toBe(name === "visitor" ? "Unauthorized" : "Forbidden");
			}
		}
	},
);
