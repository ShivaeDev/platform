import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { expiredPhone, sessionAdmin, tiedActivity } from "#test/session-admin/story.ts";

sessionAdmin.it(
	"alice lists both users' sessions with their identity and recorded times, newest activity first",
	[],
	function* ({ list, listedSessions }) {
		yield* list();

		expect(yield* listedSessions()).toEqual([
			{
				expiresAt: "2100-01-01T00:00:00.000Z",
				id: "bobPhone",
				lastActivityAt: "2026-01-04T00:00:00.000Z",
				startedAt: "2026-01-01T00:00:00.000Z",
				user: { email: "bob@sessions.test", id: "bob", name: "bob" },
			},
			{
				expiresAt: "2100-01-01T00:00:00.000Z",
				id: "bobLaptop",
				lastActivityAt: "2026-01-03T00:00:00.000Z",
				startedAt: "2026-01-01T00:00:00.000Z",
				user: { email: "bob@sessions.test", id: "bob", name: "bob" },
			},
			{
				expiresAt: "2100-01-01T00:00:00.000Z",
				id: "alice",
				lastActivityAt: "2026-01-02T00:00:00.000Z",
				startedAt: "2026-01-01T00:00:00.000Z",
				user: { email: "alice@sessions.test", id: "alice", name: "alice" },
			},
		]);
	},
);

sessionAdmin.it(
	"alice pages through the sessions in activity order and receives no next cursor on the final page",
	[],
	function* ({ list, listedDevices, nextCursor, hasNextPage }) {
		yield* list({ limit: 1 });

		expect(yield* listedDevices()).toEqual(["bobPhone"]);
		const firstCursor = yield* nextCursor();

		yield* list({ cursor: firstCursor, limit: 1 });

		expect(yield* listedDevices()).toEqual(["bobLaptop"]);
		const secondCursor = yield* nextCursor();

		yield* list({ cursor: secondCursor, limit: 1 });

		yield* outcomes([
			["last page", () => listedDevices(), ["alice"]],
			["more sessions", () => hasNextPage(), false],
		]);
	},
);

sessionAdmin.it(
	"equal activity timestamps still page to each of bob's sessions once",
	[tiedActivity],
	function* ({ list, listedDevices, nextCursor }) {
		yield* list({ limit: 1 });
		const first = yield* listedDevices();
		const cursor = yield* nextCursor();

		yield* list({ cursor, limit: 1 });

		expect([...first, ...(yield* listedDevices())].sort((left, right) => left.localeCompare(right))).toEqual(["bobLaptop", "bobPhone"]);
	},
);

sessionAdmin.it(
	"revoking a session from the first page does not skip a session on the next page",
	[],
	function* ({ list, listedDevices, nextCursor, revoke }) {
		yield* list({ limit: 1 });
		expect(yield* listedDevices()).toEqual(["bobPhone"]);
		const cursor = yield* nextCursor();

		yield* revoke("bobPhone");
		yield* list({ cursor, limit: 1 });

		expect(yield* listedDevices()).toEqual(["bobLaptop"]);
	},
);

sessionAdmin.it("alice's active sessions list excludes bob's expired phone session", [expiredPhone], function* ({ list, listedDevices }) {
	yield* list();

	expect(yield* listedDevices()).toEqual(["bobLaptop", "alice"]);
});
