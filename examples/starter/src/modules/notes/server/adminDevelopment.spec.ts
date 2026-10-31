import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";
import { requestOutcome } from "#modules/notes/test-support/requestOutcome.ts";

adminHost.it(
	"serves admin routes and guarded native jobs data through the development server",
	[adminAccount("reader"), adminAccount("reader-two"), adminAccount("operator", "admin")],
	function* ({ createNote, openAdmin, request, startDevelopment }) {
		yield* createNote("reader", "Waiting for word count");
		yield* startDevelopment();
		for (const path of ["/admin", "/admin/jobs", "/admin/notes", "/admin/users"]) {
			expect(yield* request(path)).toContain("/src/client/main.tsx");
		}
		for (const name of ["visitor", "reader", "reader-two"]) {
			const client = yield* openAdmin(name);
			for (const operation of [
				requestOutcome(client["admin.jobs.counts"]({ queue: "count-note-words" })),
				requestOutcome(client["admin.notes.statistics"]()),
				requestOutcome(client["admin.users.list"]({ limit: 20 })),
			]) {
				const result = yield* operation;
				expect(result).toBe(name === "visitor" ? "sign in required" : "permission denied");
			}
		}
		const client = yield* openAdmin("operator");
		yield* outcomes({
			"listed user emails": [
				Effect.map(client["admin.users.list"]({ limit: 20 }), ({ users }) => users.map(({ email }) => email)),
				expect.arrayContaining(["operator@app.test"]),
			],
			"note statistics": [client["admin.notes.statistics"](), { notes: 1, pending: 1, words: 0 }],
			"queued word-count jobs": [
				client["admin.jobs.counts"]({ queue: "count-note-words" }),
				expect.objectContaining({ queuedCount: 1, totalCount: 1 }),
			],
		});
	},
);
