import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { requestOutcome } from "#modules/notes/test-support/requestOutcome.ts";

app.it("targets its own host for auth actions and session checks", [signedIn("client-user")], function* ({ authClient, actor }) {
	const auth = authClient();
	expect((yield* Effect.promise(() => auth.client.getSession())).data).toBeNull();
	const { cookie, notes: client } = actor("client-user");
	const authenticated = authClient(cookie);
	const session = yield* Effect.promise(() => authenticated.client.getSession());
	yield* outcomes({
		"session user": [Effect.sync(() => session.data?.user), expect.objectContaining({ email: "client-user@app.test", name: "client-user" })],
		"session user id": [Effect.sync(() => session.data?.user.id), actor("client-user").userId],
		"sign-out error": [
			Effect.gen(function* () {
				return (yield* Effect.promise(() => authenticated.client.signOut())).error;
			}),
			null,
		],
		"signed-out session": [
			Effect.gen(function* () {
				return (yield* Effect.promise(() => authenticated.client.getSession())).data;
			}),
			null,
		],
	});
	expect(yield* requestOutcome(client.list())).toBe("sign in required");
});
