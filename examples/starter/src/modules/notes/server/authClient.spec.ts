import { Effect, Result } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("targets its own host for auth actions and session checks", [signedIn("client-user")], function* ({ authClient, actor }) {
	const auth = authClient();
	expect((yield* Effect.promise(() => auth.client.getSession())).data).toBeNull();
	const { cookie, notes: client } = actor("client-user");
	const authenticated = authClient(cookie);
	const session = yield* Effect.promise(() => authenticated.client.getSession());
	expect(session.data?.user).toMatchObject({ email: "client-user@app.test", name: "client-user" });
	expect(yield* client.whoami()).toEqual({ email: "client-user@app.test", id: session.data?.user.id, name: "client-user" });
	expect((yield* Effect.promise(() => authenticated.client.signOut())).error).toBeNull();
	expect((yield* Effect.promise(() => authenticated.client.getSession())).data).toBeNull();
	const revoked = yield* client.whoami().pipe(Effect.result);
	expect(Result.isFailure(revoked) && revoked.failure).toBeInstanceOf(Unauthorized);
});
