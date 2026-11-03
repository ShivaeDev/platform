import { expect } from "vitest";
import { defaultSessionScreen } from "#test-support/defaultSessionScreen.tsx";
import { screens } from "#test-support/screens.ts";

for (const signedIn of [false, true]) {
	const viewer = signedIn ? "alice" : "an anonymous visitor";
	screens.it(
		`${viewer} opens password reset through the default module connection`,
		[defaultSessionScreen(signedIn)],
		function* ({ heading, settle }) {
			yield* settle();

			expect(yield* heading()).toBe("Reset password");
		},
	);
}
