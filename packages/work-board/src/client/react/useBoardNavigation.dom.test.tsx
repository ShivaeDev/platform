import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { fallibleDocument } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const plan = [
	observedBrowserMotion(),
	fallibleDocument(),
	routedScreen({ "home.md": "# Home", "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n" }, "/notes/plan.md#heading-evidence", {
		home: "home.md",
	}),
];
const REFRESH_FAILED = { state: "failed", text: "Couldn't refresh this page" };

screenStory.it(
	"says Couldn't refresh this page in the header and keeps the passage when the open page fails to refresh",
	plan,
	function* ({ failDocument, navigationStatus, pageAnswer, pageText, refreshDocument }) {
		yield* failDocument();
		expect(yield* navigationStatus()).toEqual({ state: "normal", text: "" });

		yield* refreshDocument("/notes/plan.md");

		yield* outcomes({
			"the answer": [pageAnswer(), "Unavailable"],
			"the header's status": [navigationStatus(), REFRESH_FAILED],
			"the page": [pageText(), expect.stringContaining("Read this passage.")],
		});
	},
);

screenStory.it(
	"clears the header's refresh failure once the page refreshes again, without remounting the page or moving focus, scroll or the history entry",
	plan,
	function* ({
		clearMotion,
		failDocument,
		focusSearchButton,
		focusedId,
		historyEntry,
		markShell,
		navigationStatus,
		pageAnswer,
		readMotion,
		readScrollPosition,
		recoverDocument,
		refreshDocument,
		setScrollPosition,
		shellParts,
	}) {
		const entry = yield* historyEntry();
		yield* focusSearchButton();
		yield* setScrollPosition(480);
		yield* failDocument();
		yield* refreshDocument("/notes/plan.md");
		yield* recoverDocument();
		yield* clearMotion();
		yield* markShell();
		expect(yield* navigationStatus()).toEqual(REFRESH_FAILED);

		yield* refreshDocument("/notes/plan.md");

		yield* outcomes({
			"the answer": [pageAnswer(), "OK"],
			"the focus": [focusedId(), "search-open"],
			"the header's status": [navigationStatus(), { state: "normal", text: "" }],
			"the history entry": [historyEntry(), entry],
			"the passage scrolls": [readMotion("passage"), []],
			"the scroll position": [readScrollPosition(), 480],
			"the scrolls": [readMotion("scroll"), []],
			"the shell": [shellParts(), { header: "kept", main: "kept", projection: "none" }],
		});
	},
);
