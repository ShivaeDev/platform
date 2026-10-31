import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenMedia, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";
import { holdableRead } from "#test/shellTraits.tsx";

expectNoReactWarnings();

const files = {
	"home.md": "# Home\n\n## Plans\n",
	"notes/first.md": "# First\n",
	"notes/next.md": "---\nid: note.next\n---\n# Next\n",
	"notes/plan.md": "# Plan\n",
};
const savedReading = storedScreenState({
	"work-board:library:shell-fixture": JSON.stringify({
		favorites: [{ file: "notes/first.md", title: "First" }],
		recents: [
			{ file: "notes/plan.md", title: "Plan" },
			{ file: "notes/next.md", title: "Next" },
		],
	}),
});
const phone = screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]);
const history = { Earlier: ["Next"], Pinned: ["First"], Today: ["Plan (current)"] };

screenStory.it(
	"opens Reading history listing Pinned, Today and Earlier, marking the open document current",
	[screenWorkspace("shell-fixture"), savedReading, chromeScreen(files)],
	function* ({ openReadingHistory, readingHistory }) {
		expect(yield* readingHistory()).toEqual({});

		yield* openReadingHistory();

		expect(yield* readingHistory()).toEqual(history);
	},
);

screenStory.it(
	"closes Reading history with Escape and returns focus to its button",
	[screenWorkspace("shell-fixture"), savedReading, chromeScreen(files)],
	function* ({ keyboardFocus, openReadingHistory, pressKeyboard, readingHistory }) {
		yield* openReadingHistory();
		expect(yield* readingHistory()).toEqual(history);

		yield* pressKeyboard("Escape");

		yield* outcomes([
			["Reading history", () => readingHistory(), {}],
			["the focus", () => keyboardFocus(), { name: "Reading history", role: "button" }],
		]);
	},
);

const heldItem = [holdableRead("/_board/item/note.next/"), routedScreen(files, "/_board/goals", { home: "home.md" })];
const NOW = expect.stringMatching(/^Now/u);

screenStory.it(
	"marks Now current as soon as the reader starts opening it, and shows no pending feedback before 150 ms pass",
	heldItem,
	function* ({ beginOpeningWithHeldRead, currentDestination, pendingFeedback, pendingFeedbackDelayAlmostPasses }) {
		expect(yield* currentDestination()).toBe("Goals");

		yield* beginOpeningWithHeldRead("/_board/work?item=note.next");
		yield* pendingFeedbackDelayAlmostPasses();

		yield* outcomes([
			["the current destination", () => currentDestination(), NOW],
			["the pending feedback", () => pendingFeedback(), "not shown"],
		]);
	},
);

screenStory.it(
	"shows pending feedback once 150 ms pass while the page still loads",
	heldItem,
	function* ({ beginOpeningWithHeldRead, pendingFeedback, pendingFeedbackDelayPasses }) {
		yield* beginOpeningWithHeldRead("/_board/work?item=note.next");
		expect(yield* pendingFeedback()).toBe("not shown");

		yield* pendingFeedbackDelayPasses();

		expect(yield* pendingFeedback()).toBe("shown");
	},
);

screenStory.it(
	"drops the pending feedback once the page opens and keeps Now current",
	heldItem,
	function* ({ beginOpeningWithHeldRead, currentDestination, mainHeading, pendingFeedback, pendingFeedbackDelayPasses, releaseRead }) {
		yield* beginOpeningWithHeldRead("/_board/work?item=note.next");
		yield* pendingFeedbackDelayPasses();
		expect(yield* pendingFeedback()).toBe("shown");

		yield* releaseRead();

		yield* outcomes([
			["the current destination", () => currentDestination(), NOW],
			["the heading", () => mainHeading(), "Now"],
			["the pending feedback", () => pendingFeedback(), "not shown"],
		]);
	},
);

screenStory.it(
	"pins the open document into the sidebar's Pinned list",
	[screenWorkspace("shell-fixture"), chromeScreen(files)],
	function* ({ pinButton, pinPage, sidebarLinks }) {
		expect(yield* sidebarLinks("Pinned")).toEqual([]);

		yield* pinPage();

		yield* outcomes([
			["the Pinned links", () => sidebarLinks("Pinned"), [{ href: "/notes/plan.md", title: "Plan" }]],
			["the pin button", () => pinButton(), "Unpin"],
		]);
	},
);

screenStory.it(
	"unpins the open document from the sidebar's Pinned list and offers Pin again",
	[screenWorkspace("shell-fixture"), chromeScreen(files)],
	function* ({ pinButton, pinPage, sidebarLinks }) {
		yield* pinPage();
		expect(yield* sidebarLinks("Pinned")).toEqual([{ href: "/notes/plan.md", title: "Plan" }]);

		yield* pinPage();

		yield* outcomes([
			["the Pinned links", () => sidebarLinks("Pinned"), []],
			["the pin button", () => pinButton(), "Pin"],
		]);
	},
);

screenStory.it(
	"offers the pinned and other recent documents and Reading history in the phone's More sheet",
	[phone, screenWorkspace("shell-fixture"), savedReading, chromeScreen(files)],
	function* ({ moreSheet, openMore }) {
		expect(yield* moreSheet()).toBe("closed");

		yield* openMore();

		expect(yield* moreSheet()).toEqual({
			destinations: ["Pull requests", "Library", "System"],
			history: "offered",
			reading: [
				{ current: false, href: "/notes/first.md", name: "First" },
				{ current: false, href: "/notes/next.md", name: "Next" },
			],
		});
	},
);

screenStory.it(
	"replaces the phone's More sheet with Reading history when the reader chooses it there",
	[phone, screenWorkspace("shell-fixture"), savedReading, chromeScreen(files)],
	function* ({ chooseInMore, moreSheet, openMore, readingHistory }) {
		yield* openMore();
		expect(yield* readingHistory()).toEqual({});

		yield* chooseInMore("Reading history");

		yield* outcomes([
			["More", () => moreSheet(), "closed"],
			["Reading history", () => readingHistory(), history],
		]);
	},
);

screenStory.it(
	"returns focus to More when Reading history opened from More closes",
	[phone, screenWorkspace("shell-fixture"), savedReading, chromeScreen(files)],
	function* ({ chooseInMore, keyboardFocus, openMore, pressKeyboard, readingHistory }) {
		yield* openMore();
		yield* chooseInMore("Reading history");
		expect(yield* readingHistory()).toEqual(history);

		yield* pressKeyboard("Escape");

		yield* outcomes([
			["Reading history", () => readingHistory(), {}],
			["the focus", () => keyboardFocus(), { name: "More", role: "button" }],
		]);
	},
);
