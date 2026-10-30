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
	expect(session.data?.user.id).toBe(actor("client-user").userId);
	expect((yield* Effect.promise(() => authenticated.client.signOut())).error).toBeNull();
	expect((yield* Effect.promise(() => authenticated.client.getSession())).data).toBeNull();
	const revoked = yield* client.list().pipe(Effect.result);
	expect(Result.isFailure(revoked) && revoked.failure).toBeInstanceOf(Unauthorized);
});
