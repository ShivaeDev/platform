import { DateTime } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sessionClock } from "#test/sessionClock.ts";

sessionClock.it(
	"in 2100, alice stays signed in for her configured hour and expires at its end",
	[],
	function* ({ request, timePasses }) {
		expect(yield* request("alice")).toBe("alice");

		yield* timePasses("59 minutes");

		expect(yield* request("alice")).toBe("alice");

		yield* timePasses("1 minute");

		expect(yield* request("alice")).toBe("failed with unauthorized");

		yield* timePasses("1 milli");

		expect(yield* request("alice")).toBe("failed with unauthorized");
	},
	{ clock: DateTime.makeUnsafe("2100-01-01T00:00:00Z") },
);

for (const millisecondsAfter of [0, 1]) {
	sessionClock.it(
		`alice's session expires and is swept ${millisecondsAfter} milliseconds after its lifetime while bob stays signed in`,
		[],
		function* ({ clockReachesExpiry, listedSessions, mintedSession, request, storedSessions, sweep, sweptSessions }) {
			const alice = yield* mintedSession("alice");
			const bob = yield* mintedSession("bob");
			const aliceStored = { expired: false, expiresAt: DateTime.fromDateUnsafe(alice.expiresAt), id: alice.id };
			const bobStored = { expired: false, expiresAt: DateTime.fromDateUnsafe(bob.expiresAt), id: bob.id };
			yield* outcomes([
				["alice's protected request", () => request("alice"), "alice"],
				["alice's stored session", () => storedSessions("alice"), [aliceStored]],
				["bob's stored session", () => storedSessions("bob"), [bobStored]],
				["listed sessions", () => listedSessions(), ["alice", "bob"]],
			]);

			yield* clockReachesExpiry(millisecondsAfter);

			yield* outcomes([
				["alice's expired session remains stored", () => storedSessions("alice"), [{ ...aliceStored, expired: true }]],
				["alice's protected request", () => request("alice"), "failed with unauthorized"],
				["bob's protected request", () => request("bob"), "bob"],
				["listed sessions", () => listedSessions(), ["bob"]],
			]);

			yield* sweep();

			yield* outcomes([
				["alice's swept session", () => storedSessions("alice"), []],
				["bob's stored session", () => storedSessions("bob"), [bobStored]],
				["sessions removed", () => sweptSessions(), 1],
			]);
		},
	);
}

sessionClock.it("the session readout loses alice's revoked session and keeps bob's", [], function* ({ mintedSession, signOut, storedSessions }) {
	const alice = yield* mintedSession("alice");
	const bob = yield* mintedSession("bob");
	expect(yield* storedSessions("alice")).toEqual([{ expired: false, expiresAt: DateTime.fromDateUnsafe(alice.expiresAt), id: alice.id }]);

	yield* signOut("alice");

	yield* outcomes([
		["alice's revoked session", () => storedSessions("alice"), []],
		["bob's sessions", () => storedSessions("bob"), [{ expired: false, expiresAt: DateTime.fromDateUnsafe(bob.expiresAt), id: bob.id }]],
	]);
});

sessionClock.it(
	"the readout lists both of alice's sessions and none of bob's",
	[],
	function* ({ extraSession, mintAnotherSession, mintedSession, storedSessions }) {
		const alice = yield* mintedSession("alice");
		expect(yield* storedSessions("alice")).toEqual([{ expired: false, expiresAt: DateTime.fromDateUnsafe(alice.expiresAt), id: alice.id }]);

		yield* mintAnotherSession();

		const second = yield* extraSession();
		expect((yield* storedSessions("alice")).toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(
			[alice, second]
				.map(({ expiresAt, id }) => ({ expired: false, expiresAt: DateTime.fromDateUnsafe(expiresAt), id }))
				.sort((a, b) => a.id.localeCompare(b.id)),
		);
	},
);

sessionClock.it(
	"alice signs in again after 30 days on the same account for another configured hour",
	[],
	function* ({ request, requestUserId, timePasses, signsInAgain, mintedSession }) {
		const original = yield* mintedSession("alice");
		const userId = yield* requestUserId("alice");
		expect(yield* request("alice")).toBe("alice");

		yield* timePasses("30 days");

		expect(yield* request("alice")).toBe("failed with unauthorized");

		yield* signsInAgain("alice");

		expect(yield* request("alice")).toBe("alice");
		expect((yield* mintedSession("alice")).id).not.toBe(original.id);
		expect(yield* requestUserId("alice")).toBe(userId);

		yield* timePasses("1 hour");

		expect(yield* request("alice")).toBe("failed with unauthorized");
	},
);

sessionClock.it("Better Auth accepts alice's minted session with the default clock", [], function* ({ providerSession }) {
	expect(yield* providerSession("alice")).toMatchObject({ user: { email: "alice@clock.test", name: "alice" } });
});
