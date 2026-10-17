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
