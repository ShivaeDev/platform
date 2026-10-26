import { Effect } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"keeps concurrent signed-in profiles and note ownership separate and revokes access at sign-out",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous, signOut, storedNoteOwners }) {
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
		const anonymousProfile = yield* signedOut.whoami().pipe(Effect.flip);
		expect(anonymousProfile).toMatchObject({ _tag: "Unauthorized" });
		expect(anonymousProfile).toBeInstanceOf(Unauthorized);
		yield* signOut(aliceCookie);
		const revokedProfile = yield* alice.whoami().pipe(Effect.flip);
		expect(revokedProfile).toMatchObject({ _tag: "Unauthorized" });
		expect(revokedProfile).toBeInstanceOf(Unauthorized);
	},
);
