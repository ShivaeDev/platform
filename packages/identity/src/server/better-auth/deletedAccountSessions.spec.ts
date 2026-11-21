import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { accountDeletion, sessionsIn } from "#test/account-deletion/story.ts";

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

accountDeletion.it(
	"with sessions in secondary storage, alice's deletion is refused up front and her account, note and session stay",
	[sessionsIn("secondary storage")],
	function* ({ deleteAccount, request, storedNotes }) {
		const answer = yield* deleteAccount("alice");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "failed with precondition failed: This app cannot delete accounts. Ask its operator to delete yours."],
			["alice's protected request", () => request("alice"), "alice"],
			["stored notes", storedNotes, ["alice's note", "bob's note"]],
		]);
	},
);
