import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	accountDeletion,
	bookmarkOfAliceNote,
	handOverFails,
	handOverGivesProjects,
	passwordless,
	pendingVerifications,
	requiredReviewAuthor,
} from "#test/account-deletion/story.ts";

accountDeletion.it(
	"alice deletes her account with her password: her note and her password sign-in go, bob's note stays, and her user and the sessions list are announced",
	[],
	function* ({ announcedKeys, deleteAccount, signIn, storedNotes }) {
		expect(yield* storedNotes()).toEqual(["alice's note", "bob's note"]);

		const answer = yield* deleteAccount("alice");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "deleted"],
			["stored notes", storedNotes, ["bob's note"]],
			["alice signs in with her password", () => signIn("alice"), "refused with 401"],
			["announced keys", announcedKeys, ["identity.users:alice", "identity.users", "identity.sessions"]],
		]);
	},
);

accountDeletion.it(
	"after alice deletes her account her session check answers signed out and her next protected request is refused",
	[],
	function* ({ deleteAccount, request, sessionCheck }) {
		expect(yield* request("alice")).toBe("alice");

		yield* deleteAccount("alice");

		yield* outcomes([
			["alice's session check", () => sessionCheck("alice"), "signed out"],
			["alice's protected request", () => request("alice"), "failed with unauthorized"],
			["bob's session check", () => sessionCheck("bob"), "signed in"],
		]);
	},
);

accountDeletion.it(
	"the hand-over runs with alice's id before the erase, so the project it gives bob stays while her note goes",
	[handOverGivesProjects],
	function* ({ deleteAccount, storedNotes, storedProjectOwners }) {
		yield* deleteAccount("alice");

		yield* outcomes([
			["stored project owners", storedProjectOwners, ["bob", "bob"]],
			["stored notes", storedNotes, ["bob's note"]],
		]);
	},
);

accountDeletion.it(
	"when the hand-over fails, its own change rolls back with the deletion and alice still signs in with every row in place",
	[handOverFails],
	function* ({ announcedKeys, deleteAccount, signIn, storedNotes, storedProjectOwners }) {
		const answer = yield* deleteAccount("alice");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "failed with internal server error"],
			["stored project owners", storedProjectOwners, ["alice", "bob"]],
			["stored notes", storedNotes, ["alice's note", "bob's note"]],
			["alice signs in with her password", () => signIn("alice"), "signed in"],
			["announced keys", announcedKeys, []],
		]);
	},
);

for (const [failure, trait] of [
	["the erase fails because bob's bookmark still references alice's note", bookmarkOfAliceNote],
	["the auth delete fails because alice's review cannot lose its author", requiredReviewAuthor],
] as const) {
	accountDeletion.it(
		`when ${failure}, nothing is deleted and alice still signs in with her password`,
		[trait],
		function* ({ announcedKeys, deleteAccount, sessionCheck, signIn, storedNotes }) {
			const answer = yield* deleteAccount("alice");

			yield* outcomes([
				["answer", () => Effect.succeed(answer), "failed with internal server error"],
				["stored notes", storedNotes, ["alice's note", "bob's note"]],
				["alice's session check", () => sessionCheck("alice"), "signed in"],
				["alice signs in with her password", () => signIn("alice"), "signed in"],
				["announced keys", announcedKeys, []],
			]);
		},
	);
}

for (const [given, password, refusal] of [
	["a wrong password", "not-alice-password", "bad request: The password is incorrect."],
	["an empty password", "", "bad request: Enter your current password."],
	["a password longer than Better Auth accepts", "x".repeat(129), "bad request: Enter your current password."],
] as const) {
	accountDeletion.it(
		`a deletion confirmed with ${given} is refused and deletes nothing`,
		[],
		function* ({ deleteAccount, sessionCheck, storedNotes }) {
			const answer = yield* deleteAccount("alice", password);

			yield* outcomes([
				["answer", () => Effect.succeed(answer), `failed with ${refusal}`],
				["stored notes", storedNotes, ["alice's note", "bob's note"]],
				["alice's session check", () => sessionCheck("alice"), "signed in"],
			]);
		},
	);
}

accountDeletion.it(
	"an account without a password is refused its deletion and keeps its note",
	[passwordless],
	function* ({ deleteAccount, sessionCheck, storedNotes }) {
		const answer = yield* deleteAccount("alice");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "failed with precondition failed: This account has no password to confirm its deletion with."],
			["stored notes", storedNotes, ["alice's note", "bob's note"]],
			["alice's session check", () => sessionCheck("alice"), "signed in"],
		]);
	},
);

accountDeletion.it(
	"deleting alice's account removes her pending password reset and email code and keeps bob's",
	[pendingVerifications],
	function* ({ deleteAccount, storedVerifications }) {
		expect(yield* storedVerifications()).toEqual([
			"email-verification-otp-alice@deletion.test",
			"email-verification-otp-bob@deletion.test",
			"reset-password:alice-token",
			"reset-password:bob-token",
		]);

		yield* deleteAccount("alice");

		expect(yield* storedVerifications()).toEqual(["email-verification-otp-bob@deletion.test", "reset-password:bob-token"]);
	},
);

accountDeletion.it(
	"Better Auth's /delete-user stays closed although the options enable user.deleteUser, and alice keeps her account",
	[],
	function* ({ deleteThroughBetterAuth, sessionCheck, storedNotes }) {
		const status = yield* deleteThroughBetterAuth("alice");

		yield* outcomes([
			["closed route", () => Effect.succeed(status), HttpStatus.fromLiteral("NotFound")],
			["alice's session check", () => sessionCheck("alice"), "signed in"],
			["stored notes", storedNotes, ["alice's note", "bob's note"]],
		]);
	},
);
