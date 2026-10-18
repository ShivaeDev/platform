import { Effect } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"keeps concurrent signed-in profiles and note ownership separate and revokes access at sign-out",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous, authenticate, readConcurrentProfiles, storedNoteOwner }) {
		const { cookie: aliceCookie, notes: alice } = actor();
		const names = Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? "alice" : "bob"));
		const profiles = yield* readConcurrentProfiles(names);
		const aliceProfile = profiles[0];
		const bobProfile = profiles[1];
		expect(aliceProfile).toEqual({ email: "alice@app.test", id: expect.any(String), name: "alice" });
		expect(bobProfile).toEqual({ email: "bob@app.test", id: expect.any(String), name: "bob" });
		expect(aliceProfile?.id).not.toBe(bobProfile?.id);
		profiles.forEach((profile, index) => {
			expect(profile).toEqual(index % 2 === 0 ? aliceProfile : bobProfile);
		});
		const note = yield* alice.create({ title: "Owned by the current user" });
		expect(yield* storedNoteOwner(note.title)).toEqual([{ ownerId: aliceProfile?.id }]);
		const signedOut = yield* anonymous();
		const anonymousProfile = yield* signedOut.whoami().pipe(Effect.flip);
		expect(anonymousProfile).toMatchObject({ _tag: "Unauthorized" });
		expect(anonymousProfile).toBeInstanceOf(Unauthorized);
		yield* authenticate("alice", "sign-out", aliceCookie);
		const revokedProfile = yield* alice.whoami().pipe(Effect.flip);
		expect(revokedProfile).toMatchObject({ _tag: "Unauthorized" });
		expect(revokedProfile).toBeInstanceOf(Unauthorized);
	},
);
