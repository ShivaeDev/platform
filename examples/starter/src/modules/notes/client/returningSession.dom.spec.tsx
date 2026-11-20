import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { returningAlice, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"a returning person sees her notes while the session check is still on the wire, never the session check status",
	[returningAlice("held")],
	function* (story) {
		yield* story.settle();

		yield* outcomes([
			["page", story.heading, "Notes"],
			["notes", story.shownNotes, ["no notes yet"]],
			["session check status", story.sessionCheckStatus, "not shown"],
		]);

		yield* story.releaseSessionCheck();
		yield* story.settle();

		expect(yield* story.heading()).toBe("Notes");
	},
);

screens.it(
	"a returning person whose session check fails keeps her notes instead of a session error",
	[returningAlice("failing")],
	function* ({ alert, heading, settle, shownNotes }) {
		yield* settle();

		yield* outcomes([
			["page", heading, "Notes"],
			["notes", shownNotes, ["no notes yet"]],
			["session error", alert, "no alert"],
		]);
	},
);

screens.it(
	"signing out wipes the remembered session even when the session check after it never answers",
	[returningAlice("held")],
	function* ({ click, relaunches, releaseSessionCheck, sessionCheckStatus, settle }) {
		yield* releaseSessionCheck();
		yield* settle();
		yield* click("Sign out");
		yield* settle();

		yield* relaunches();

		expect(yield* sessionCheckStatus()).toBe("shown");
	},
);
