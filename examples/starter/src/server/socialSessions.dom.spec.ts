import { Effect } from "effect";
import { expect } from "vitest";
import { socialApp } from "#test-support/socialApp.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

socialApp.it(
	"a social sign-in returns from the fake provider with a PostgreSQL cookie session",
	[],
	function* ({ signInWithGitHub, signedInPageIs }) {
		yield* signInWithGitHub();
		yield* signedInPageIs("alice@social.test");
	},
);

socialApp.it(
	"provider account IDs follow the signed-in user through the PostgreSQL host",
	[],
	function* ({ signInWithGitHub, providerAccounts, signOut, signUpWithEmail, failAccountLookup }) {
		yield* signInWithGitHub();
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
		yield* signOut();
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		yield* signUpWithEmail();
		const accounts = yield* providerAccounts();
		expect(accounts.find(({ providerId }) => providerId === "github")).toBeUndefined();
		expect(accounts).toEqual([{ accountId: expect.any(String), providerId: "credential" }]);
		yield* failAccountLookup();
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable" } });
	},
);
