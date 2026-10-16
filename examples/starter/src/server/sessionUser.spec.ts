import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { authPost, credentials, notesHttp } from "#test-support/authHttp.ts";
import { effectApp } from "#test-support/postgres.ts";

effectApp("reads each signed-in user's profile through SessionUser over PostgreSQL and HTTP", function* ({ baseUrl }) {
	const aliceCookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const bobCookie = yield* authPost(baseUrl, "sign-up/email", credentials("bob"));
	const alice = yield* notesHttp(baseUrl, aliceCookie);
	const bob = yield* notesHttp(baseUrl, bobCookie);
	const profiles = yield* Effect.all(
		Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? alice : bob)["notes.whoami"]()),
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
	const note = yield* alice["notes.create"]({ title: "Owned by the current user" });
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select "ownerId" from starter_notes where id = ${note.id}`).toEqual([{ ownerId: aliceProfile?.id }]);
	const anonymous = yield* notesHttp(baseUrl);
	const denied = yield* anonymous["notes.whoami"]().pipe(Effect.result);
	expect(Result.isFailure(denied) && denied.failure).toBeInstanceOf(Unauthorized);
	yield* authPost(baseUrl, "sign-out", {}, aliceCookie);
	const revoked = yield* alice["notes.whoami"]().pipe(Effect.result);
	expect(Result.isFailure(revoked) && revoked.failure).toBeInstanceOf(Unauthorized);
});
