import { app, signedIn } from "#test-support/application.ts";

app.it(
	"keeps concurrent signed-in profiles and note ownership separate and revokes access at sign-out",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous, authenticate, concurrentProfilesAreIsolated, storedNoteOwnerIs, rejectsWith }) {
		const { cookie: aliceCookie, notes: alice } = actor();
		const aliceProfile = yield* concurrentProfilesAreIsolated();
		const note = yield* alice.create({ title: "Owned by the current user" });
		yield* storedNoteOwnerIs(note.title, aliceProfile.id);
		const signedOut = yield* anonymous();
		yield* signedOut.whoami().pipe(rejectsWith("Unauthorized"));
		yield* authenticate("alice", "sign-out", aliceCookie);
		yield* alice.whoami().pipe(rejectsWith("Unauthorized"));
	},
);
