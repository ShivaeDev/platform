import { expect } from "vitest";
import { authStorage, mintedAccounts, withoutAuthHost } from "#test/better-auth/database.ts";

authStorage.it(
	"a worker without an auth mount sweeps only expired sessions and reports the number removed",
	[mintedAccounts(), withoutAuthHost],
	function* ({ expireSessions, storedSessions, storedUsers, sweepExpiredSessions }) {
		const users = yield* storedUsers();
		const before = yield* storedSessions();
		expect(before).toEqual([
			{ email: "alice@storage.test", id: expect.any(String), userId: users[0]?.id },
			{ email: "bob@storage.test", id: expect.any(String), userId: users[1]?.id },
		]);
		const expired = before.filter((session) => session.userId === users[0]?.id);
		yield* expireSessions(users[0]?.id);
		expect(yield* sweepExpiredSessions()).toBe(expired.length);
		expect(yield* storedSessions()).toEqual([{ email: "bob@storage.test", id: expect.any(String), userId: users[1]?.id }]);
		expect(yield* sweepExpiredSessions()).toBe(0);
	},
);

authStorage.it(
	"a swept session cookie no longer authenticates while the live session stays signed in",
	[mintedAccounts()],
	function* ({ expireSessions, session, storedSessions, storedUsers, sweepExpiredSessions }) {
		expect(yield* session("alice")).toMatchObject({ body: { user: { email: "alice@storage.test" } }, status: 200 });
		const users = yield* storedUsers();
		const expired = (yield* storedSessions()).filter((stored) => stored.userId === users[0]?.id);
		yield* expireSessions(users[0]?.id);
		expect(yield* sweepExpiredSessions()).toBe(expired.length);
		expect(yield* storedSessions()).toEqual([{ email: "bob@storage.test", id: expect.any(String), userId: users[1]?.id }]);
		expect(yield* session("alice")).toEqual({ body: null, status: 200 });
		expect(yield* session("bob")).toMatchObject({ body: { user: { email: "bob@storage.test" } }, status: 200 });
	},
);
