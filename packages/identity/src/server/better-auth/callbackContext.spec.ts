import { expect } from "vitest";
import { allowed, mintedSession, organizationRule, policyWaits, signInPolicy } from "#test/sign-in-policy/story.ts";

const callbacks = {
	"new-user validation": [],
	"session creation": [mintedSession("bob")],
};

for (const [callback, sessions] of Object.entries(callbacks)) {
	signInPolicy.it(
		`Better Auth's ${callback} callback reads the Layer's ConfigProvider to refuse bob`,
		[allowed("alice"), ...sessions],
		function* ({ signIn, signInAnswer }) {
			yield* signIn("bob");

			expect(yield* signInAnswer("bob")).toBe("refused");
		},
	);

	signInPolicy.it(
		`cancelling a GitHub sign-in interrupts the waiting policy in Better Auth's ${callback} callback`,
		[organizationRule, ...sessions, policyWaits],
		function* ({ cancelSignIn, cancelledSignInPolicy }) {
			yield* cancelSignIn("bob");

			expect(yield* cancelledSignInPolicy()).toBe("interrupted");
		},
	);
}
