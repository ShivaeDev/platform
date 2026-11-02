import { Effect } from "effect";
import { expect } from "vitest";
import { AuthFailure } from "#client/AuthFailure.ts";
import { authRefusalsStory } from "#test/auth-refusals/story.ts";

for (const [source, wire, code] of [
	["policy", "sign_in_refused", "SIGN_IN_REFUSED"],
	["policy outage", "sign_in_unavailable", "AUTH_UNAVAILABLE"],
	["role seed", "role_seed_failed", "AUTH_UNAVAILABLE"],
	["database hook", "MEMBERS_ONLY", "MEMBERS_ONLY"],
] as const) {
	authRefusalsStory.it(`${source} reaches the client as ${code}`, [], function* ({ refuse, signIn, storedSessions }) {
		yield* refuse(source);

		const failure = yield* Effect.flip(signIn());

		expect(failure).toMatchObject({ _tag: "AuthFailure", cause: { code: wire }, code });
		expect(yield* storedSessions()).toEqual([]);
	});
}

authRefusalsStory.it("an email-delivery refusal retains the application's declared code", [], function* ({ refuse, requestReset }) {
	yield* refuse("email delivery");

	const failure = yield* Effect.flip(requestReset());

	expect(failure).toMatchObject({ _tag: "AuthFailure", cause: { code: "MAIL_UNAVAILABLE" }, code: "MAIL_UNAVAILABLE" });
});

authRefusalsStory.it("an undeclared application code remains UNKNOWN", [], function* ({ refuse, signInWithoutApplicationCodes }) {
	yield* refuse("database hook");

	const failure = yield* Effect.flip(signInWithoutApplicationCodes());

	expect(failure).toBeInstanceOf(AuthFailure);
	expect(failure).toMatchObject({ cause: { code: "MEMBERS_ONLY" }, code: "UNKNOWN" });
});

authRefusalsStory.it("identity's codes work without declaring application codes", [], function* ({ refuse, signInWithoutApplicationCodes }) {
	yield* refuse("policy");

	const failure = yield* Effect.flip(signInWithoutApplicationCodes());

	expect(failure).toBeInstanceOf(AuthFailure);
	expect(failure.code).toBe("SIGN_IN_REFUSED");
});

authRefusalsStory.it("Better Auth's credential failure keeps its typed code", [], function* ({ signIn }) {
	const failure = yield* Effect.flip(signIn("wrong-password"));

	expect(failure).toBeInstanceOf(AuthFailure);
	expect(failure).toMatchObject({ cause: { code: "INVALID_EMAIL_OR_PASSWORD" }, code: "INVALID_EMAIL_OR_PASSWORD" });
});

authRefusalsStory.it("an admitted sign-in returns Better Auth's data and creates a session", [], function* ({ signIn, storedSessions }) {
	const data = yield* signIn();

	expect(data).toMatchObject({ user: { email: "alice@example.test" } });
	expect(yield* storedSessions()).toEqual(["alice@example.test"]);
});
