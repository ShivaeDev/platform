import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authStorage, mintedAccounts, missingImageColumn } from "#test/better-auth/database.ts";

authStorage.it("the test database lists each stored user by id and email only", [mintedAccounts()], function* ({ storedUserRows, userId }) {
	expect(yield* storedUserRows()).toEqual([
		{ email: "alice@storage.test", id: yield* userId("alice") },
		{ email: "bob@storage.test", id: yield* userId("bob") },
	]);
});

authStorage.it(
	"the test database lists each stored session by its id and its owner's id and email only",
	[mintedAccounts()],
	function* ({ storedSessionRows, userId }) {
		expect(yield* storedSessionRows()).toEqual([
			{ email: "alice@storage.test", id: expect.any(String), userId: yield* userId("alice") },
			{ email: "bob@storage.test", id: expect.any(String), userId: yield* userId("bob") },
		]);
	},
);

authStorage.it(
	"expiring every stored session signs alice and bob out and keeps both their users",
	[mintedAccounts()],
	function* ({ expireAllSessions, signedInAs, storedUsers }) {
		yield* outcomes({
			"alice's cookie": [signedInAs("alice"), "alice"],
			"bob's cookie": [signedInAs("bob"), "bob"],
		});

		yield* expireAllSessions();

		yield* outcomes({
			"alice's cookie": [signedInAs("alice"), "signed out"],
			"bob's cookie": [signedInAs("bob"), "signed out"],
			"stored users": [storedUsers(), ["alice", "bob"]],
		});
	},
);

authStorage.it(
	"expiring alice's stored sessions signs her out and leaves bob signed in",
	[mintedAccounts()],
	function* ({ expireSessions, signedInAs }) {
		yield* outcomes({
			"alice's cookie": [signedInAs("alice"), "alice"],
			"bob's cookie": [signedInAs("bob"), "bob"],
		});

		yield* expireSessions("alice");

		yield* outcomes({
			"alice's cookie": [signedInAs("alice"), "signed out"],
			"bob's cookie": [signedInAs("bob"), "bob"],
		});
	},
);

authStorage.it(
	"when the auth schema lacks the user image column, the mounted provider answers alice's session request as unavailable",
	[mintedAccounts(), missingImageColumn()],
	function* ({ signedInAs }) {
		expect(yield* signedInAs("alice")).toBe("auth unavailable");
	},
);
