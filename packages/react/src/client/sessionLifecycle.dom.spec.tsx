import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	activitySessions,
	activityShown,
	hiddenSessions,
	rerenderedWhileHidden,
	rotations,
	signedInWithCredential,
	strictSessions,
	strictSignedIn,
} from "#test/lifecycleStories.tsx";
import { aliceEdited, aliceRefreshedAfterExpiry, aliceSignedIn, sessionScreens } from "#test/sessionStories.ts";

sessionScreens.it(
	"showing alice's unchanged session again keeps her typed draft in the session's one registry",
	[aliceEdited("Alice draft")],
	function* ({ draft, sessionRegistries, showAgain }) {
		yield* showAgain();

		yield* outcomes({
			"alice's draft": [draft(), "Alice draft"],
			"sessions with a registry": [sessionRegistries(), ["alice-1"]],
		});
	},
);

sessionScreens.it(
	"switching from alice to bob shows bob's order and empties alice's registry",
	[aliceSignedIn()],
	function* ({ draft, heldAtoms, shownOrder, signIn }) {
		expect(yield* heldAtoms("alice-1")).toBeGreaterThan(0);

		yield* signIn("bob");

		yield* outcomes({
			"alice's atoms": [heldAtoms("alice-1"), 0],
			"bob's draft": [draft(), "Desk lamps"],
			"shown order": [shownOrder(), "Desk lamps / 200"],
		});
	},
);

sessionScreens.it(
	"signing out shows Signed out and empties the session's registry",
	[aliceSignedIn()],
	function* ({ heldAtoms, screenText, signOut }) {
		expect(yield* heldAtoms("alice-1")).toBeGreaterThan(0);

		yield* signOut();

		yield* outcomes({
			"alice's atoms": [heldAtoms("alice-1"), 0],
			screen: [screenText(), "Signed out"],
		});
	},
);

sessionScreens.it(
	"alice signing in again after signing out starts from her saved order in a new registry",
	[aliceEdited("Alice draft")],
	function* ({ draft, sessionRegistries, signIn, signOut }) {
		yield* signOut();

		yield* signIn("alice");

		yield* outcomes({
			"alice's draft": [draft(), "Printer paper"],
			"sessions with a registry": [sessionRegistries(), ["alice-1", "alice-2"]],
		});
	},
);

sessionScreens.it("closing the session screen empties the session's registry", [aliceSignedIn()], function* ({ close, heldAtoms }) {
	expect(yield* heldAtoms("alice-1")).toBeGreaterThan(0);

	yield* close();

	expect(yield* heldAtoms("alice-1")).toBe(0);
});

sessionScreens.it(
	"a refresh after alice's session expires shows the load error beside her order and draft, and asks the auth owner to recheck once",
	[aliceEdited("Unsaved order")],
	function* ({ alert, draft, rechecks, refresh, sessionExpires, shownOrder }) {
		yield* sessionExpires("alice");

		yield* refresh();

		yield* outcomes({
			alert: [alert(), "Could not load your order. Try again."],
			"alice's draft": [draft(), "Unsaved order"],
			rechecks: [rechecks(), ["alice-1"]],
			"shown order": [shownOrder(), "Printer paper / 300"],
		});
	},
);

sessionScreens.it(
	"once alice's session is valid again, a refresh clears the load error and keeps her draft",
	[aliceRefreshedAfterExpiry("Unsaved order")],
	function* ({ alert, draft, refresh, sessionIsValidAgain }) {
		yield* sessionIsValidAgain("alice");
		expect(yield* alert()).toBe("Could not load your order. Try again.");

		yield* refresh();

		yield* outcomes({
			alert: [alert(), "no alert"],
			"alice's draft": [draft(), "Unsaved order"],
		});
	},
);

strictSessions.it(
	"under StrictMode a signed-in session keeps its value and registry after React replays its effects",
	[strictSignedIn()],
	function* ({ registry, shown }) {
		yield* outcomes({
			registry: [registry(), "holds atoms"],
			shown: [shown(), "draft-1:42"],
		});
	},
);

strictSessions.it(
	"signing out under StrictMode clears the screen and empties the session's registry",
	[strictSignedIn()],
	function* ({ registry, shown, signOut }) {
		expect(yield* registry()).toBe("holds atoms");

		yield* signOut();

		yield* outcomes({
			registry: [registry(), "empty"],
			shown: [shown(), ""],
		});
	},
);

for (const element of ["hoisted", "recreated"] as const) {
	activitySessions.it(
		`hiding and revealing a session rendered from a ${element} element keeps its draft and live registry without a render error`,
		[activityShown(element)],
		function* ({ hideAndReveal, registry, renderErrors, shown }) {
			yield* hideAndReveal();

			yield* outcomes({
				registry: [registry(), "holds atoms"],
				"render errors": [renderErrors(), []],
				shown: [shown(), "draft-1:42"],
			});
		},
	);

	activitySessions.it(
		`closing an Activity screen whose session was rendered from a ${element} element empties every registry the session used`,
		[activityShown(element)],
		function* ({ close, hideAndReveal, registries }) {
			yield* hideAndReveal();
			expect(yield* registries()).toContain("holds atoms");

			yield* close();

			expect(yield* registries()).not.toContain("holds atoms");
		},
	);
}

hiddenSessions.it(
	"closing a session that rendered again while hidden releases every resource its renders built",
	[rerenderedWhileHidden()],
	function* ({ builtResources, close, releasedResources, renderedRounds }) {
		yield* outcomes({
			"built resources": [builtResources(), expect.arrayContaining([1, 2])],
			"rendered rounds": [renderedRounds(), expect.arrayContaining([2])],
		});

		yield* close();

		expect(yield* releasedResources()).toBe("released");
	},
);

for (const [identifiedBy, token, connections] of [
	["session id", "t1", ["t1"]],
	["credential", "t2", ["t1", "t2"]],
] as const) {
	rotations.it(
		`a session identified by ${identifiedBy} that rotates its credential shows token ${token} after connecting with ${connections.join(" then ")}`,
		[signedInWithCredential(identifiedBy)],
		function* ({ connections: connected, rotate, shownToken }) {
			yield* rotate();

			yield* outcomes({
				connections: [connected(), [...connections]],
				"shown token": [shownToken(), token],
			});
		},
	);
}
