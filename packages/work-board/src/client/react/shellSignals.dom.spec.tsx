import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const phone = screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]);
const libraryShell = [phone, chromeScreen({ "home.md": "# Home" }, "/_board/library")];

screenStory.it(
	"closes the phone sidebar without a new history entry when the reader picks Library while already there",
	libraryShell,
	function* ({ historyEntry, openSidebarDestination, sidebarPanel, toggleSidebar }) {
		const entry = yield* historyEntry();
		yield* toggleSidebar();
		expect((yield* sidebarPanel()).shown).toBe(true);

		yield* openSidebarDestination("Library");

		yield* outcomes({
			"the history entry": [historyEntry(), entry],
			"the sidebar shown": [sidebarPanel(), expect.objectContaining({ shown: false })],
		});
	},
);

screenStory.it(
	"closes More without a new history entry when the reader picks Library while already there",
	libraryShell,
	function* ({ chooseInMore, historyEntry, moreSheet, openMore }) {
		const entry = yield* historyEntry();
		yield* openMore();
		expect(yield* moreSheet()).not.toBe("closed");

		yield* chooseInMore("Library");

		yield* outcomes({
			"More": [moreSheet(), "closed"],
			"the history entry": [historyEntry(), entry],
		});
	},
);

const files = { "home.md": "# Home", "notes/plan.md": "# Plan", "other.md": "# Other" };

screenStory.it(
	"closes the phone sidebar when the Board navigates elsewhere",
	[phone, chromeScreen(files)],
	function* ({ navigate, sidebarPanel, toggleSidebar }) {
		yield* toggleSidebar();
		expect((yield* sidebarPanel()).shown).toBe(true);

		yield* navigate("/other.md");

		expect((yield* sidebarPanel()).shown).toBe(false);
	},
);

screenStory.it("closes More when the Board navigates elsewhere", [phone, chromeScreen(files)], function* ({ moreSheet, navigate, openMore }) {
	yield* openMore();
	expect(yield* moreSheet()).not.toBe("closed");

	yield* navigate("/other.md");

	expect(yield* moreSheet()).toBe("closed");
});

screenStory.it(
	"puts a page's revised title in the browser title once the page refreshes",
	[chromeScreen(files)],
	function* ({ browserTitle, editFile, refreshDocument }) {
		yield* editFile("notes/plan.md", "# Revised plan");
		expect(yield* browserTitle()).toBe("Plan · Work Board");

		yield* refreshDocument("/notes/plan.md");

		expect(yield* browserTitle()).toBe("Revised plan · Work Board");
	},
);

screenStory.it(
	"lists a refreshed page under Recent by its revised title once the reader moves on",
	[chromeScreen(files)],
	function* ({ editFile, navigate, refreshDocument, sidebarLinks }) {
		yield* editFile("notes/plan.md", "# Revised plan");
		yield* refreshDocument("/notes/plan.md");
		expect(yield* sidebarLinks("Recent")).toEqual([]);

		yield* navigate("/other.md");

		expect(yield* sidebarLinks("Recent")).toEqual([{ href: "/notes/plan.md", title: "Revised plan" }]);
	},
);

screenStory.it(
	"focuses the linked Evidence heading once a phone opens the page at it",
	[phone, routedScreen({ "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage." }, "/notes/plan.md#heading-evidence")],
	function* ({ focusedId }) {
		expect(yield* focusedId()).toBe("heading-evidence");
	},
);
