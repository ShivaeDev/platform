import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveLoader, liveNoteLoadedButNotMounted, liveNoteMountedAfterIdleWindow, liveNoteShown } from "#test/live-loader/story.tsx";

for (const [when, given] of [
	["as soon as its loader answers", liveNoteShown("Live note")],
	["after the registry's idle window", liveNoteMountedAfterIdleWindow("Live note")],
] as const) {
	liveLoader.it(
		`a live route whose component mounts ${when} shows the loader's result from one query run on one subscription`,
		[given],
		function* ({ firstRenders, queryRuns, subscriptions }) {
			yield* outcomes([
				["first render", firstRenders, ["Live note"]],
				["query runs", queryRuns, ["get"]],
				["subscriptions", subscriptions, ["open"]],
			]);
		},
	);
}

liveLoader.it(
	"leaving a live route before it mounts keeps its loader's subscription open only until the hand-over window passes",
	[liveNoteLoadedButNotMounted("Unread note")],
	function* ({ handOverWindowPasses, leave, shownTitle, subscriptions }) {
		yield* leave();

		yield* outcomes([
			["shown title", shownTitle, "Other screen"],
			["subscriptions", subscriptions, ["open"]],
		]);

		yield* handOverWindowPasses();

		expect(yield* subscriptions()).toEqual(["closed"]);
	},
);
