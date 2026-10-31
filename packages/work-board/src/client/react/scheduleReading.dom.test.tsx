import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { framesFollowed, readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { shellIds } from "./shellIds.ts";

expectNoReactWarnings();

const PASSAGE = "heading-evidence";
const savedPassage = [
	framesFollowed(),
	observedBrowserMotion(),
	componentScreen(
		<article id={shellIds.doc}>
			<h2 id={PASSAGE} tabIndex={-1}>
				Evidence
			</h2>
		</article>,
	),
];

screenStory.it(
	"restoring a saved reading scrolls once to the saved position without scrolling to or focusing the passage, and announces nothing",
	savedPassage,
	function* ({ readMotion, readReadingStatus, restoreSavedReading }) {
		yield* restoreSavedReading([0, 480], PASSAGE);

		yield* outcomes([
			["announcements", () => readReadingStatus(), [""]],
			["focus", () => readMotion("focus"), []],
			["passage scrolls", () => readMotion("passage"), []],
			["window scrolls", () => readMotion("scroll"), [[0, 480]]],
		]);
	},
);

const files = {
	"home.md": "# Home",
	"notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n\n<details><summary>More</summary>Saved reading details.</details>",
	"other.md": "# Other",
};
const EDITED = "# Plan\n\nThe heading disappeared.\n\n<details><summary>More</summary>Saved reading details.</details>";
const missingPassage = {
	hash: "heading-evidence",
	"open sections": ["More"],
	"passage scrolls": [],
	status: { state: "normal", text: "This passage is no longer in the document." },
	"window scrolls": [[0, 480]] satisfies [number, number][],
};

screenStory.it(
	"coming Back to a saved passage that was edited away says so, restores the scroll and open sections, and focuses the page",
	[observedBrowserMotion(), readingPage(files, "/notes/plan.md#heading-evidence")],
	function* ({
		addressHash,
		clearMotion,
		goBack,
		navigateTo,
		navigationStatus,
		openSection,
		openSections,
		readMotion,
		readerFocus,
		rewriteDocument,
		setScrollPosition,
	}) {
		yield* rewriteDocument("notes/plan.md", EDITED);
		yield* openSection("More");
		yield* setScrollPosition(480);
		yield* navigateTo("/other.md");
		yield* setScrollPosition(0);
		yield* clearMotion();

		yield* goBack();

		yield* outcomes([
			["focus", () => readerFocus(), "the page"],
			["hash", () => addressHash(), missingPassage.hash],
			["open sections", () => openSections(), missingPassage["open sections"]],
			["passage scrolls", () => readMotion("passage"), missingPassage["passage scrolls"]],
			["status", () => navigationStatus(), missingPassage.status],
			["window scrolls", () => readMotion("scroll"), missingPassage["window scrolls"]],
		]);
	},
);

screenStory.it(
	"reloading a saved passage that was edited away says so, restores the scroll and open sections, and leaves focus alone",
	[observedBrowserMotion(), readingPage(files, "/notes/plan.md#heading-evidence")],
	function* ({
		addressHash,
		clearMotion,
		navigationStatus,
		openSection,
		openSections,
		readMotion,
		readerFocus,
		reloadReading,
		rewriteDocument,
		setScrollPosition,
	}) {
		yield* rewriteDocument("notes/plan.md", EDITED);
		yield* openSection("More");
		yield* setScrollPosition(480);
		yield* clearMotion();

		yield* reloadReading();

		yield* outcomes([
			["focus", () => readerFocus(), "nothing"],
			["hash", () => addressHash(), missingPassage.hash],
			["open sections", () => openSections(), missingPassage["open sections"]],
			["passage scrolls", () => readMotion("passage"), missingPassage["passage scrolls"]],
			["status", () => navigationStatus(), missingPassage.status],
			["window scrolls", () => readMotion("scroll"), missingPassage["window scrolls"]],
		]);
	},
);
