import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { homeScreen } from "#test-support/homeScreen.tsx";
import { screens } from "#test-support/screens.ts";

screens.it("keeps a home page and sign-in route without feature modules", [homeScreen], function* ({ screenContent, clickControl }) {
	const content = yield* screenContent();
	yield* eventually(() => expect(content.querySelector("h1")?.textContent).toBe("Your app"));
	yield* clickControl('a[href="/sign-in"]');
	yield* eventually(() => expect(content.querySelector("h1")?.textContent).toBe("Sign in"));
});
