import { expect } from "vitest";
import { homeScreen } from "#test-support/homeScreen.tsx";
import { screens } from "#test-support/screens.ts";

screens.it("keeps a home page and sign-in route without feature modules", [homeScreen], function* ({ settle, screenContent, clickControl }) {
	const content = yield* screenContent();
	yield* settle();
	expect(content.querySelector("h1")?.textContent).toBe("Your app");
	yield* clickControl("a");
	yield* settle();
	expect(content.querySelector("h1")?.textContent).toBe("Sign in");
});
