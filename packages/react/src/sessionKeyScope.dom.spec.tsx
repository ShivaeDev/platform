import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { privateNotes, signedInPrivately } from "#test/live-session/story.tsx";

for (const credential of ["bearer", "cookie"] as const) {
	privateNotes.it(
		`showing alice's unchanged session again keeps her one private connection (${credential})`,
		[signedInPrivately(credential, ["alice"])],
		function* ({ connections, showAgain, shown }) {
			yield* showAgain();

			yield* outcomes({
				connections: [connections(), ["alice-1"]],
				shown: [shown(), "First"],
			});
		},
	);

	privateNotes.it(
		`switching from alice to bob shows bob's note, gives the server only bob's stream and empties alice's registry (${credential})`,
		[signedInPrivately(credential, ["alice"])],
		function* ({ heldAtoms, shown, signIn, subscribers }) {
			expect(yield* subscribers()).toEqual(["alice"]);

			yield* signIn("bob");

			yield* outcomes({
				"alice's registry": [heldAtoms("alice-1"), "empty"],
				shown: [shown(), "Bob note"],
				subscribers: [subscribers(), ["bob"]],
			});
		},
	);

	privateNotes.it(
		`signing out releases bob's private stream, empties his registry and shows Signed out (${credential})`,
		[signedInPrivately(credential, ["alice", "bob"])],
		function* ({ heldAtoms, shown, signOut, subscribers }) {
			expect(yield* subscribers()).toEqual(["bob"]);

			yield* signOut();

			yield* outcomes({
				"bob's registry": [heldAtoms("bob-1"), "empty"],
				shown: [shown(), "Signed out"],
				subscribers: [subscribers(), []],
			});
		},
	);

	privateNotes.it(
		`alice signing in again after signing out reads her note's current title through a new registry (${credential})`,
		[signedInPrivately(credential, ["alice"])],
		function* ({ renameAlicesNote, sameRegistry, shown, signIn, signOut, subscribers }) {
			yield* signOut();
			yield* renameAlicesNote("Alice changed while away");

			yield* signIn("alice");

			yield* outcomes({
				"same registry as alice-1": [sameRegistry("alice-1", "alice-2"), false],
				shown: [shown(), "Alice changed while away"],
				subscribers: [subscribers(), ["alice"]],
			});
		},
	);
}
