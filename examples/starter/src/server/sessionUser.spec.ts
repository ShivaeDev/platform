import { Effect } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"keeps concurrent signed-in profiles and note ownership separate and revokes access at sign-out",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous, authenticate, storedNoteOwners, rejectsWith }) {
		const { cookie: aliceCookie, notes: alice } = actor();
		const bob = actor("bob").notes;
		const profiles = yield* Effect.all(
			Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? alice : bob).whoami()),
			{
				concurrency: "unbounded",
			},
		);
		const aliceProfile = profiles[0];
		const bobProfile = profiles[1];
		if (aliceProfile === undefined || bobProfile === undefined) {
			throw new Error("Concurrent requests returned no profiles");
		}
		expect(aliceProfile).toEqual({ email: "alice@app.test", id: expect.any(String), name: "alice" });
		expect(bobProfile).toEqual({ email: "bob@app.test", id: expect.any(String), name: "bob" });
		expect(aliceProfile.id).not.toBe(bobProfile.id);
		profiles.forEach((profile, index) => {
			expect(profile).toEqual(index % 2 === 0 ? aliceProfile : bobProfile);
		});
		const note = yield* alice.create({ title: "Owned by the current user" });
		expect(yield* storedNoteOwners(note.title)).toEqual([{ ownerId: aliceProfile.id }]);
		const signedOut = yield* anonymous();
		yield* signedOut.whoami().pipe(rejectsWith("Unauthorized"));
		yield* authenticate("alice", "sign-out", aliceCookie);
		yield* alice.whoami().pipe(rejectsWith("Unauthorized"));
	},
);
