import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { signOutIsReady, signOuts } from "#test/signOutStories.tsx";

signOuts.it("a successful sign-out navigates to sign-in", [signOutIsReady()], function* ({ clickSignOut, destinations, signOutSucceeds }) {
	yield* clickSignOut();
	expect(yield* destinations()).toEqual([]);

	yield* signOutSucceeds();

	expect(yield* destinations()).toEqual(["/sign-in"]);
});

signOuts.it(
	"a sign-out that succeeds after its component unmounts navigates nowhere",
	[signOutIsReady()],
	function* ({ clickSignOut, destinations, leave, signOutSucceeds }) {
		yield* clickSignOut();
		yield* leave();

		yield* signOutSucceeds();

		expect(yield* destinations()).toEqual([]);
	},
);

signOuts.it(
	"clicking Sign out again while it is pending sends no second request and navigates once",
	[signOutIsReady()],
	function* ({ clickSignOut, destinations, requests, signOutSucceeds }) {
		yield* clickSignOut();

		yield* clickSignOut();
		yield* signOutSucceeds();

		yield* outcomes({
			"navigation destinations": [destinations(), ["/sign-in"]],
			"sign-out requests": [requests(), ["sign-out"]],
		});
	},
);

signOuts.it("a sign-out the auth owner starts shows as pending on the screen", [signOutIsReady()], function* ({ authOwnerStartsSignOut, phase }) {
	expect(yield* phase()).toBe("Ready");

	yield* authOwnerStartsSignOut();

	expect(yield* phase()).toBe("Signing out");
});
