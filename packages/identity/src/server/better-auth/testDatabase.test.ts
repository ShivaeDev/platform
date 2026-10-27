import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { authStorage, mintedAccounts, missingImageColumn } from "#test/better-auth/database.ts";

authStorage.it(
	"reads stored identities and session ownership without exposing credentials",
	[mintedAccounts()],
	function* ({ session, storedUsers, storedSessions }) {
		const users = yield* storedUsers();
		expect(users).toEqual([
			{ email: "alice@storage.test", id: expect.any(String) },
			{ email: "bob@storage.test", id: expect.any(String) },
		]);
		expect(yield* session("alice")).toMatchObject({ body: { user: users[0] }, status: HttpStatus.fromLiteral("OK") });
		expect(yield* session("bob")).toMatchObject({ body: { user: users[1] }, status: HttpStatus.fromLiteral("OK") });
		expect(yield* storedSessions()).toEqual([
			{ email: "alice@storage.test", id: expect.any(String), userId: users[0]?.id },
			{ email: "bob@storage.test", id: expect.any(String), userId: users[1]?.id },
		]);
	},
);

authStorage.it(
	"expiring sessions changes provider answers while keeping the accounts",
	[mintedAccounts()],
	function* ({ session, storedUsers, expireSessions }) {
		expect(yield* session("alice")).toMatchObject({ body: { user: { email: "alice@storage.test" } }, status: HttpStatus.fromLiteral("OK") });
		const users = yield* storedUsers();
		yield* expireSessions();
		expect(yield* session("alice")).toEqual({ body: null, status: HttpStatus.fromLiteral("OK") });
		expect(yield* session("bob")).toEqual({ body: null, status: HttpStatus.fromLiteral("OK") });
		expect(yield* storedUsers()).toEqual(users);
	},
);

authStorage.it("a missing image column is refused by the mounted provider", [mintedAccounts(), missingImageColumn()], function* ({ session }) {
	expect(yield* session("alice")).toEqual({
		body: "Authentication is temporarily unavailable",
		status: HttpStatus.fromLiteral("ServiceUnavailable"),
	});
});
