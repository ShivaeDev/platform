import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { framesFollowed } from "#test/readingScreenTraits.tsx";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";
import { noteLinks, readStamp } from "#test/shellExpectations.ts";

expectNoReactWarnings();

const HOUR = 3_600_000;
const files = {
	"notes/first.md": "# First\n",
	"notes/next.md": "---\nkind: task\nstatus: ready\n---\n# Next\n",
	"notes/old.md": "---\nkind: question\nscope: task\nurgency: whenever\n---\n# Old\n",
	"notes/plan.md": "# Plan\n",
};
const today = new Date(Effect.runSync(Clock.currentTimeMillis)).setHours(0, 0, 0, 0);
const yesterday = today - 12 * HOUR;
const lastWeek = today - 3 * 24 * HOUR + 12 * HOUR;
const lastWeekDay = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", weekday: "long" }).format(lastWeek);
const history = [
	screenWorkspace("history-fixture"),
	storedScreenState({
		"work-board:library:history-fixture": JSON.stringify({
			favorites: [{ file: "notes/first.md", title: "First" }],
			recents: [
				{ at: yesterday, file: "notes/next.md", title: "Next" },
				{ at: yesterday - HOUR, file: "notes/first.md", title: "First" },
				{ at: lastWeek, file: "notes/old.md", title: "Old" },
				{ file: "notes/gone.md", title: "Gone" },
			],
		}),
	}),
	framesFollowed(),
	chromeScreen(files),
];

screenStory.it(
	"the sidebar's Recent list leaves out pinned documents and the open page, and the page the reader leaves joins it",
	history,
	function* ({ navigateTo, sidebarLinks }) {
		expect(yield* sidebarLinks("Recent")).toEqual(noteLinks("Next", "Old", "Gone"));

		yield* navigateTo("/notes/next.md");

		expect(yield* sidebarLinks("Recent")).toEqual(noteLinks("Plan", "Old", "Gone"));
	},
);

screenStory.it(
	"Reading history groups entries under the day they were read and shows when each was read, its kind and status",
	history,
	function* ({ historyDays, openReadingHistory }) {
		yield* openReadingHistory();

		expect(yield* historyDays()).toEqual({
			Earlier: ["Gone (missing)"],
			Pinned: ["First · Document"],
			Today: [expect.stringMatching(/^Plan · read \S+ · Document$/u)],
			Yesterday: [`Next · ${readStamp(yesterday)} · Task · Ready`, `First · ${readStamp(yesterday - HOUR)} · Document`],
			[lastWeekDay]: [`Old · ${readStamp(lastWeek)} · Question`],
		});
	},
);

screenStory.it(
	"removing an entry drops it from Reading history and the sidebar's Recent list, also after a reload",
	history,
	function* ({ historyDays, openReadingHistory, reloadShell, removeFromHistory, sidebarLinks }) {
		yield* openReadingHistory();
		expect(yield* sidebarLinks("Recent")).toEqual(noteLinks("Next", "Old", "Gone"));

		yield* removeFromHistory("Old");

		yield* outcomes({
			history: [historyDays(), expect.not.objectContaining({ [lastWeekDay]: expect.anything() })],
			recent: [sidebarLinks("Recent"), noteLinks("Next", "Gone")],
		});
		yield* reloadShell();
		expect(yield* sidebarLinks("Recent")).toEqual(noteLinks("Next", "Gone"));
	},
);

screenStory.it(
	"after removing an entry, focus moves to the next entry's remove button",
	history,
	function* ({ openReadingHistory, readerFocus, removeFromHistory }) {
		yield* openReadingHistory();

		yield* removeFromHistory("Next");

		expect(yield* readerFocus()).toBe("button Remove First from history");
	},
);

screenStory.it(
	"Clear history first asks in the dialog to remove all five entries and puts focus on Cancel",
	history,
	function* ({ clearConfirmation, clearHistory, openReadingHistory, readerFocus }) {
		yield* openReadingHistory();

		yield* clearHistory();

		yield* outcomes({
			confirmation: [clearConfirmation(), "Remove 5 entries from history? Pinned documents stay."],
			focus: [readerFocus(), "button Cancel"],
		});
	},
);

screenStory.it(
	"closing Reading history returns focus to the sidebar button that opened it",
	history,
	function* ({ closeReadingHistory, openReadingHistory, readerFocus }) {
		yield* openReadingHistory();
		expect(yield* readerFocus()).toBe("link First");

		yield* closeReadingHistory();

		expect(yield* readerFocus()).toBe("button Reading history");
	},
);

screenStory.it(
	"cancelling Clear history keeps every entry",
	history,
	function* ({ answerClearConfirmation, clearHistory, historyDays, openReadingHistory }) {
		yield* openReadingHistory();
		const before = yield* historyDays();
		yield* clearHistory();

		yield* answerClearConfirmation("Cancel");

		expect(yield* historyDays()).toEqual(before);
	},
);

screenStory.it(
	"confirming Clear history empties Reading history and the Recent list, keeps pinned documents, and returns focus to the dialog",
	history,
	function* ({ answerClearConfirmation, clearConfirmation, clearHistory, historyDays, openReadingHistory, readerFocus, sidebarLinks }) {
		yield* openReadingHistory();
		yield* clearHistory();

		yield* answerClearConfirmation("Clear");

		yield* outcomes({
			confirmation: [clearConfirmation(), "none"],
			focus: [readerFocus(), "dialog Reading history"],
			history: [historyDays(), { Pinned: ["First · Document"] }],
			recent: [sidebarLinks("Recent"), []],
		});
	},
);
