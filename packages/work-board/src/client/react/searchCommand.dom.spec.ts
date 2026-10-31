import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const twoEvidenceHeadings = { "home.md": "# Home", "notes/plan.md": "# Plan\n\n## Evidence\n\nKnown phrase.\n\n## Evidence\n\nSecond phrase." };

screenStory.it(
	"Ctrl+K opens Search with keyboard focus in its search field",
	[chromeScreen(twoEvidenceHeadings)],
	function* ({ keyboardFocus, openSearchWithShortcut, searchDialog }) {
		expect(yield* searchDialog()).toBe("closed");

		yield* openSearchWithShortcut();

		yield* outcomes({
			focus: [keyboardFocus(), expect.objectContaining({ role: "combobox" })],
			search: [searchDialog(), "open"],
		});
	},
);

screenStory.it(
	"Enter on a passage under the second of two Evidence headings opens that heading, focuses it and closes Search",
	[chromeScreen(twoEvidenceHeadings)],
	function* ({ currentPage, focusedId, openSearchWithShortcut, pressInSearch, searchDialog, searchFor, selectedResult }) {
		yield* openSearchWithShortcut();
		yield* searchFor("second phrase");
		expect((yield* selectedResult()).selected).toBe("Evidence");

		yield* pressInSearch("Enter");

		yield* outcomes({
			focus: [focusedId(), "heading-evidence-2"],
			page: [currentPage(), "/notes/plan.md#heading-evidence-2"],
			search: [searchDialog(), "closed"],
		});
	},
);

screenStory.it(
	"after a palette command runs, keyboard focus returns to the Search button that opened it",
	[chromeScreen(chromeFixture())],
	function* ({ focusedId, openSearch, pressInSearch, searchDialog, searchFor }) {
		yield* openSearch();
		yield* searchFor("sidebar");

		yield* pressInSearch("Enter");

		yield* outcomes({
			focus: [focusedId(), "search-open"],
			search: [searchDialog(), "closed"],
		});
	},
);
