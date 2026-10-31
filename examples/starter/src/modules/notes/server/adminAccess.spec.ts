import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";
import { requestOutcome } from "#modules/notes/test-support/requestOutcome.ts";

adminHost.it(
	"serves app statistics across owners and the registered job queue on the existing RPC host",
	[adminAccount("alice"), adminAccount("bob"), adminAccount("operator", "admin")],
	function* ({ createNote, openAdmin, startWorker }) {
		yield* createNote("alice", "Alice's note");
		yield* createNote("bob", "Bob's note");
		const client = yield* openAdmin("operator");
		yield* outcomes([
			[
				"admin jobs counts",
				() => client["admin.jobs.counts"]({ queue: "count-note-words" }),
				expect.objectContaining({ queuedCount: 2, totalCount: 2 }),
			],
			["admin notes statistics", () => client["admin.notes.statistics"](), { notes: 2, pending: 2, words: 0 }],
		]);
		const health = yield* client["admin.jobs.health"]();
		expect(health.jobs.map((queue) => queue.name)).toEqual(["count-note-words"]);
		yield* startWorker();
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(client["admin.notes.statistics"]()), { timeout: 8000 }).toEqual({ notes: 2, pending: 0, words: 4 }),
		);
	},
);

adminHost.it(
	"keeps both app admin pages forbidden to users without the domain permissions",
	[adminAccount("reader"), adminAccount("reader-two")],
	function* ({ openAdmin }) {
		for (const name of ["reader", "reader-two", "visitor"]) {
			const client = yield* openAdmin(name);
			for (const query of [requestOutcome(client["admin.notes.statistics"]()), requestOutcome(client["admin.jobs.health"]())]) {
				const result = yield* query;
				expect(result).toBe(name === "visitor" ? "sign in required" : "permission denied");
			}
		}
	},
);
