import { Effect } from "effect";
import { expect } from "vitest";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";

adminHost.it(
	"serves admin routes and guarded native jobs data through the development server",
	[adminAccount("reader"), adminAccount("reader-two"), adminAccount("operator", "admin")],
	function* ({ createNote, openAdmin, request, startDevelopment }) {
		yield* createNote("reader", "Waiting for word count");
		yield* startDevelopment();
		for (const path of ["/admin", "/admin/jobs", "/admin/notes", "/admin/users"]) {
			expect(yield* request(path)).toContain("/src/client/entry.tsx");
		}
		for (const name of ["visitor", "reader", "reader-two"]) {
			const client = yield* openAdmin(name);
			for (const operation of [
				Effect.result(client["admin.jobs.counts"]({ queue: "count-note-words" })),
				Effect.result(client["admin.notes.statistics"]()),
				Effect.result(client["admin.users.list"]({ limit: 20 })),
			]) {
				const result = yield* operation;
				expect(result._tag === "Failure" && result.failure._tag, JSON.stringify(result)).toBe(name === "visitor" ? "Unauthorized" : "Forbidden");
			}
		}
		const client = yield* openAdmin("operator");
		expect(yield* client["admin.jobs.counts"]({ queue: "count-note-words" })).toMatchObject({ queuedCount: 1, totalCount: 1 });
		expect((yield* client["admin.users.list"]({ limit: 20 })).users.map(({ email }) => email)).toContain("operator@app.test");
		expect(yield* client["admin.notes.statistics"]()).toEqual({ notes: 1, pending: 1, words: 0 });
	},
);
