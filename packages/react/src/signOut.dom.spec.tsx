import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pendingSignOut, signOuts } from "#test/signOutStories.tsx";

signOuts.it("a successful sign-out navigates to sign-in", [pendingSignOut()], function* ({ click, complete, destinations }) {
	yield* click();
	expect(destinations()).toEqual([]);

	yield* complete();

	expect(destinations()).toEqual(["/sign-in"]);
});

signOuts.it("unmount during sign-out stops follow-up navigation", [pendingSignOut()], function* ({ click, complete, destinations, unmount }) {
	yield* click();
	yield* unmount();

	yield* complete();

	expect(destinations()).toEqual([]);
});

signOuts.it("a second click starts no second request or navigation", [pendingSignOut()], function* ({ click, complete, destinations, requests }) {
	yield* click();

	yield* click();
	yield* complete();

	yield* outcomes({
		"navigation destinations": [Effect.sync(destinations), ["/sign-in"]],
		"sign-out requests": [Effect.sync(requests), ["sign-out"]],
	});
});

signOuts.it("a sign-out started by the auth owner remains pending in the screen", [pendingSignOut()], function* ({ phase, startFromAuthOwner }) {
	expect(phase()).toBe("Ready");

	yield* startFromAuthOwner();

	expect(phase()).toBe("Signing out");
});
