import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceSession, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"switching to bob's session replaces alice's cached notes and clears her draft",
	[aliceSession()],
	function* ({ draft, enter, settle, settleQuery, shownNotes, switchSession }) {
		yield* enter("Alice's private draft");
		expect(yield* shownNotes()).toEqual(["Alice's saved note"]);

		yield* switchSession("bob");
		yield* settleQuery("list");
		yield* settle();

		yield* outcomes([
			["notes", shownNotes, ["no notes yet"]],
			["draft", draft, ""],
		]);
	},
);
