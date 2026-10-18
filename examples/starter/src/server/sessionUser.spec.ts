import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"keeps concurrent signed-in profiles and note ownership separate and revokes access at sign-out",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous, authenticate, concurrentProfilesAreIsolated, storedNoteOwners, rejectsWith }) {
		const { cookie: aliceCookie, notes: alice } = actor();
		const aliceProfile = yield* concurrentProfilesAreIsolated();
		const note = yield* alice.create({ title: "Owned by the current user" });
		expect(yield* storedNoteOwners(note.title)).toEqual([{ ownerId: aliceProfile.id }]);
		const signedOut = yield* anonymous();
		yield* signedOut.whoami().pipe(rejectsWith("Unauthorized"));
		yield* authenticate("alice", "sign-out", aliceCookie);
		yield* alice.whoami().pipe(rejectsWith("Unauthorized"));
	},
);
