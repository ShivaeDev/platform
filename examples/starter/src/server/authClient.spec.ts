import { Effect, Result } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { app } from "#test-support/application.ts";
import { credentials } from "#test-support/authHttp.ts";

app.it("targets its own host for auth actions and session checks", [], function* ({ authClient, authenticate, notes }) {
	const auth = authClient();
	const account = credentials("client-user");
	expect((yield* Effect.promise(() => auth.client.getSession())).data).toBeNull();
	expect((yield* Effect.promise(() => auth.client.signUp.email(account))).error).toBeNull();
	expect((yield* Effect.promise(() => auth.client.signIn.email(account))).error).toBeNull();
	const cookie = yield* authenticate("client-user", "sign-in/email");
	const signedIn = authClient(cookie);
	const session = yield* Effect.promise(() => signedIn.client.getSession());
	expect(session.data?.user).toMatchObject({ email: account.email, name: account.name });
	const client = yield* notes(cookie);
	expect(yield* client.whoami()).toEqual({ email: account.email, id: session.data?.user.id, name: account.name });
	expect((yield* Effect.promise(() => signedIn.client.signOut())).error).toBeNull();
	expect((yield* Effect.promise(() => signedIn.client.getSession())).data).toBeNull();
	const revoked = yield* client.whoami().pipe(Effect.result);
	expect(Result.isFailure(revoked) && revoked.failure).toBeInstanceOf(Unauthorized);
});
