import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminScreen, adminScreens, pendingNote } from "#modules/notes/test-support/admin/screens.tsx";

adminScreens.it("the Jobs page filters by foundation and note word-count queues", [adminScreen()], function* ({ queueFilter, settle }) {
	yield* settle();

	expect(yield* queueFilter()).toEqual(["identity.auth-emails", "sweep-expired-auth-sessions", "count-note-words"]);
});

adminScreens.it(
	"the admin navigation opens note statistics with the app's pending note",
	[pendingNote, adminScreen()],
	function* ({ heading, noteStatistics, opensNoteStatistics, settle }) {
		yield* settle();

		yield* opensNoteStatistics();

		yield* outcomes([
			["page", heading, "Note statistics"],
			["statistics", noteStatistics, { Notes: "1", "Pending counts": "1", Words: "0" }],
		]);
	},
);
