import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { signedInApp } from "#test-support/signedInApp.ts";

signedInApp.it("alice opens her notes signed in with the app's cookie session", [], function* ({ heading, settle, shownNotes }) {
	yield* settle();

	yield* outcomes([
		["page", heading, "Notes"],
		["notes", shownNotes, ["no notes yet"]],
	]);
});

signedInApp.it(
	"alice hears her own list change and never hears bob's list key",
	[],
	function* ({ bobAddsNote, click, enter, heardKeys, listKey, settle, waitsForHint }) {
		yield* settle();
		const hints = yield* waitsForHint();
		yield* bobAddsNote("Private note");
		yield* enter("Shopping");

		yield* click("Add note");
		yield* hints.next;
		yield* settle();

		yield* outcomes([
			["alice’s list key", heardKeys, expect.arrayContaining([listKey("alice")])],
			["bob’s list key", heardKeys, expect.not.arrayContaining([listKey("bob")])],
		]);
	},
);
