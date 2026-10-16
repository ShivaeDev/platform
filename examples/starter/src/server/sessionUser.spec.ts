import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"reads each signed-in user's profile through SessionUser over PostgreSQL and HTTP",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous, authenticate }) {
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
		expect(aliceProfile).toEqual({ email: "alice@starter.test", id: expect.any(String), name: "alice" });
		expect(bobProfile).toEqual({ email: "bob@starter.test", id: expect.any(String), name: "bob" });
		expect(aliceProfile?.id).not.toBe(bobProfile?.id);
		profiles.forEach((profile, index) => {
			expect(profile).toEqual(index % 2 === 0 ? aliceProfile : bobProfile);
		});
		const note = yield* alice.create({ title: "Owned by the current user" });
		const sql = yield* SqlClient.SqlClient;
		expect(yield* sql`select "ownerId" from starter_notes where id = ${note.id}`).toEqual([{ ownerId: aliceProfile?.id }]);
		const signedOut = yield* anonymous();
		const denied = yield* signedOut.whoami().pipe(Effect.result);
		expect(Result.isFailure(denied) && denied.failure).toBeInstanceOf(Unauthorized);
		yield* authenticate("alice", "sign-out", aliceCookie);
		const revoked = yield* alice.whoami().pipe(Effect.result);
		expect(Result.isFailure(revoked) && revoked.failure).toBeInstanceOf(Unauthorized);
	},
);
