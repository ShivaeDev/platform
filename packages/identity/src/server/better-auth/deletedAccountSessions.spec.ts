import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cachedAddressCodes, lostSessionList, sessionsIn } from "#test/account-deletion/sessions.ts";
import { accountDeletion } from "#test/account-deletion/story.ts";

accountDeletion.it(
	"with the cookie cache on, alice's session resolves no user once she deletes her account, though Better Auth's own session check still answers from the cache",
	[sessionsIn("cookie cache")],
	function* ({ deleteAccount, request, sessionCheck, storedNotes, writesNote }) {
		yield* deleteAccount("alice");

		yield* outcomes([
			["alice's protected request", () => request("alice"), "failed with unauthorized"],
			["alice's note write", () => writesNote("alice", "written after deletion"), "failed with unauthorized"],
			["stored notes", storedNotes, ["bob's note"]],
			["Better Auth's cookie-cached session check", () => sessionCheck("alice"), "signed in"],
		]);
	},
);

for (const storage of ["secondary storage", "secondary storage and the database", "secondary storage whose client parses JSON"] as const) {
	accountDeletion.it(
		`with sessions in ${storage}, alice's session resolves no user once she deletes her account, and bob's still does`,
		[sessionsIn(storage)],
		function* ({ deleteAccount, request, storedNotes, writesNote }) {
			const answer = yield* deleteAccount("alice");

			yield* outcomes([
				["answer", () => Effect.succeed(answer), "deleted"],
				["alice's protected request", () => request("alice"), "failed with unauthorized"],
				["alice's note write", () => writesNote("alice", "written after deletion"), "failed with unauthorized"],
				["stored notes", storedNotes, ["bob's note"]],
				["bob's protected request", () => request("bob"), "bob"],
			]);
		},
	);
}

accountDeletion.it(
	"with verifications in secondary storage, deleting alice's account removes her address's email code and keeps bob's",
	[sessionsIn("secondary storage"), cachedAddressCodes],
	function* ({ cachedAddressCodes: codes, deleteAccount }) {
		yield* deleteAccount("alice");

		yield* outcomes([["cached address codes", codes, ["bob"]]]);
	},
);

for (const storage of ["secondary storage", "secondary storage and the database"] as const) {
	accountDeletion.it(
		`with sessions in ${storage} and their list lost, sixty seconds after alice signed in her deletion still ends her session through Better Auth's revoked-before time`,
		[sessionsIn(storage), lostSessionList],
		function* ({ deleteAccount, request, waits, writesNote }) {
			yield* waits("60 seconds");

			yield* deleteAccount("alice");

			yield* outcomes([
				["alice's protected request", () => request("alice"), "failed with unauthorized"],
				["alice's note write", () => writesNote("alice", "written after deletion"), "failed with unauthorized"],
				["bob's protected request", () => request("bob"), "bob"],
			]);
		},
	);
}
