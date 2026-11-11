import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveNoteAwaitingFirstAnswer, liveScreen } from "#test/live-screen/story.tsx";

liveScreen.it("a live query keeps the screen pending until its first answer arrives", [liveNoteAwaitingFirstAnswer], function* ({ screenWork }) {
	expect(yield* screenWork()).toBe("pending");
});

liveScreen.it(
	"a screen settles on its first live answer while the live subscription stays open",
	[liveNoteAwaitingFirstAnswer],
	function* ({ respond, screenWork, shownTitle, subscriptions }) {
		yield* respond("Live note");

		yield* outcomes([
			["shown title", shownTitle, "Live note"],
			["screen work", screenWork, "settled"],
			["subscriptions", subscriptions, ["open"]],
		]);
	},
);
