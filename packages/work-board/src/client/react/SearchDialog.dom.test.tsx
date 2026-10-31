import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { unavailableWorkspace, unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchOpened } from "#test/shellTraits.tsx";

expectNoReactWarnings();

const threeNotes = {
	"notes/first.md": "# First\n\nShared phrase one.",
	"notes/second.md": "# Second\n\nShared phrase two.",
	"notes/third.md": "# Third\n\nShared phrase three.",
};

screenStory.it(
	"when a refresh drops the selected third result, the remaining first result becomes selected and announced",
	[searchOpened(threeNotes)],
	function* ({ editFile, pressInSearch, refreshSearch, resultTitles, searchFor, selectedResult }) {
		yield* searchFor("Shared phrase");
		yield* pressInSearch("ArrowDown");
		yield* pressInSearch("ArrowDown");
		yield* editFile("notes/second.md", "# Second\n\nNo match.");
		yield* editFile("notes/third.md", "# Third\n\nNo match.");
		expect(yield* selectedResult()).toEqual({ announced: "Third", selected: "Third" });

		yield* refreshSearch("Shared phrase");

		yield* outcomes({
			results: [resultTitles(), ["First"]],
			selection: [selectedResult(), { announced: "First", selected: "First" }],
		});
	},
);

screenStory.it(
	"Enter opens the selected result and closes Search",
	[searchOpened(threeNotes)],
	function* ({ browserPath, pressInSearch, searchDialog, searchFor }) {
		yield* searchFor("Shared phrase");
		yield* pressInSearch("ArrowDown");

		yield* pressInSearch("Enter");

		yield* outcomes({
			address: [browserPath(), "/notes/second.md"],
			search: [searchDialog(), "closed"],
		});
	},
);

for (const { previous, typed } of [
	{ previous: "Go to Today", typed: "" },
	{ previous: "First", typed: "First phrase" },
]) {
	screenStory.it(
		`Enter pressed before the search pause ends searches for the new words instead of opening ${previous}`,
		[searchOpened({ "notes/first.md": "# First\n\nFirst phrase.", "notes/second.md": "# Second\n\nSecond phrase." })],
		function* ({ pressInSearch, resultTitles, searchDialog, searchFor, selectedResult, typeBeforeSearchPause }) {
			if (typed) {
				yield* searchFor(typed);
			}
			expect((yield* selectedResult()).selected).toBe(previous);
			yield* typeBeforeSearchPause("Second phrase");

			yield* pressInSearch("Enter");

			yield* outcomes({
				results: [resultTitles(), ["Second"]],
				search: [searchDialog(), "open"],
				selected: [selectedResult(), { announced: "Second", selected: "Second" }],
			});
		},
	);
}

screenStory.it(
	"Retry search runs a failed search again once the workspace can be read",
	[searchOpened({ "notes/first.md": "# First\n\nShared phrase one." }), unavailableWorkspace()],
	function* ({ recoverWorkspace, resultTitles, retrySearch, searchFor, searchStatus }) {
		yield* searchFor("Shared phrase");
		yield* recoverWorkspace();
		expect(yield* searchStatus()).toBe("Search could not be completed.");

		yield* retrySearch();

		yield* outcomes({
			results: [resultTitles(), ["First"]],
			status: [searchStatus(), "1 matches."],
		});
	},
);

for (const { key, moves, selected } of [
	{ key: "Home", moves: ["ArrowDown"], selected: "Second" },
	{ key: "End", moves: [], selected: "First" },
]) {
	screenStory.it(
		`${key} moves the caret in the search field without moving the selection off ${selected}`,
		[searchOpened({ "notes/first.md": "# First\n\nShared phrase one.", "notes/second.md": "# Second\n\nShared phrase two." })],
		function* ({ pressInSearch, searchFor, selectedResult }) {
			yield* searchFor("Shared phrase");
			for (const move of moves) {
				yield* pressInSearch(move);
			}
			expect((yield* selectedResult()).selected).toBe(selected);

			yield* pressInSearch(key);

			expect((yield* selectedResult()).selected).toBe(selected);
		},
	);
}

screenStory.it(
	"a search says its results are incomplete when a workspace file cannot be read",
	[searchOpened({ "home.md": "# Home\n", "notes/first.md": "# First\n\nShared phrase one." }, { home: "home.md" }), unreadableHome()],
	function* ({ searchFor, searchStatus }) {
		yield* searchFor("Shared phrase");

		expect(yield* searchStatus()).toBe("1 matches. Could not read 1 files; results are incomplete.");
	},
);
