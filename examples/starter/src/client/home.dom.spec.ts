import { expect } from "vitest";
import { homeScreen } from "#test-support/homeScreen.tsx";
import { screens } from "#test-support/screens.ts";

screens.it("an app without feature modules shows its home page, which links to sign-in", [homeScreen], function* ({ clickControl, heading, settle }) {
	yield* settle();
	expect(yield* heading()).toBe("Your app");

	yield* clickControl("a");
	yield* settle();

	expect(yield* heading()).toBe("Sign in");
});
