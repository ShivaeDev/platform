import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { blockedStorage, fallibleDocument, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = chromeFixture();
const MISSING_PLAN = "No Markdown file at notes/plan.md. It may have been moved or deleted.";

for (const path of ["/_board/attachment/shots/review.png", "/_board/unsupported"]) {
	screenStory.it(
		`leaves a link to ${path} to the browser without reading a page`,
		[chromeScreen(files)],
		function* ({ clickLinkTo, currentPage, linkClick, readPageRequests }) {
			const reads = yield* readPageRequests();

			yield* clickLinkTo(path);

			yield* outcomes([
				["the document reads", () => readPageRequests(), reads],
				["the link", () => linkClick(), "the browser follows it"],
				["the page", () => currentPage(), "/notes/plan.md"],
			]);
		},
	);
}

screenStory.it(
	"keeps a pinned document whose file was deleted in Reading history, marked missing",
	[screenWorkspace("missing-favorite"), chromeScreen(files)],
	function* ({ deleteFile, navigate, openReadingHistory, pinPage, readingHistory, refreshDocument }) {
		yield* pinPage();
		yield* navigate("/notes/deep/proof.md");
		yield* deleteFile("notes/plan.md");
		yield* refreshDocument();
		expect(yield* readingHistory()).toEqual({});

		yield* openReadingHistory();

		expect((yield* readingHistory()).Pinned).toEqual(["Plan (missing)"]);
	},
);

screenStory.it(
	"opens a deleted pinned document to the page's not-found notice, leaving the header's status empty",
	[screenWorkspace("missing-favorite"), chromeScreen(files)],
	function* ({
		deleteFile,
		mainHeading,
		navigate,
		navigationStatus,
		openFromReadingHistory,
		openReadingHistory,
		pageNotice,
		pinPage,
		refreshDocument,
	}) {
		yield* pinPage();
		yield* navigate("/notes/deep/proof.md");
		yield* deleteFile("notes/plan.md");
		yield* refreshDocument();
		yield* refreshDocument("/notes/plan.md");
		yield* openReadingHistory();
		expect(yield* mainHeading()).toBe("Proof");

		yield* openFromReadingHistory("Plan");

		yield* outcomes([
			["the header's status", () => navigationStatus(), { state: "normal", text: "" }],
			["the notice", () => pageNotice(), expect.objectContaining({ description: MISSING_PLAN })],
		]);
	},
);

screenStory.it(
	"keeps a pinned document in the sidebar across navigation when storage is blocked",
	[screenWorkspace("blocked-favorites"), blockedStorage(), chromeScreen(files)],
	function* ({ navigate, pinButton, pinPage, sidebarLinks }) {
		yield* pinPage();
		expect(yield* pinButton()).toBe("Unpin");

		yield* navigate("/notes/deep/proof.md");

		expect(yield* sidebarLinks("Pinned")).toEqual([{ href: "/notes/plan.md", title: "Plan" }]);
	},
);

screenStory.it(
	"says Reading history applies to this page only when storage is blocked",
	[screenWorkspace("blocked-favorites"), blockedStorage(), chromeScreen(files)],
	function* ({ historyNotice, openReadingHistory }) {
		expect(yield* historyNotice()).toBeUndefined();

		yield* openReadingHistory();

		expect(yield* historyNotice()).toBe("Reading history applies to this page only.");
	},
);

screenStory.it(
	"stays on the same history entry when the reader follows a link to the open document",
	[screenWorkspace("same-reading"), chromeScreen(files)],
	function* ({ follow, historyEntry }) {
		const entry = yield* historyEntry();

		yield* follow("/notes/plan.md");

		expect(yield* historyEntry()).toBe(entry);
	},
);

screenStory.it(
	"reopens the Evidence block the reader opened when they come back to the document",
	[screenWorkspace("same-reading"), chromeScreen(files)],
	function* ({ back, detailsBlock, navigate, openDetailsBlock }) {
		yield* openDetailsBlock("Evidence");
		yield* navigate("/notes/deep/proof.md");

		yield* back();

		expect(yield* detailsBlock("Evidence")).toBe("open");
	},
);

screenStory.it(
	"leaves explaining a failed document read to the page instead of the header",
	[fallibleDocument(), chromeScreen(files)],
	function* ({ failDocument, navigate, navigationStatus, pageAddress, pageAnswer }) {
		yield* failDocument();

		yield* navigate("/notes/deep/proof.md");

		yield* outcomes([
			["the answer", () => pageAnswer(), "Unavailable"],
			["the header's status", () => navigationStatus(), { state: "normal", text: "" }],
			["the page", () => pageAddress(), "/notes/deep/proof.md"],
		]);
	},
);

for (const failed of [false, true]) {
	screenStory.it(
		`keeps the newer page when a held refresh of the page before ${failed ? "fails" : "arrives"} late`,
		[chromeScreen(files)],
		function* ({ mainHeading, navigate, pageAddress, pauseRead, refreshDocument, releaseRefresh }) {
			yield* pauseRead("/notes/plan.md", failed);
			yield* refreshDocument();
			yield* navigate("/notes/deep/proof.md");
			expect(yield* mainHeading()).toBe("Proof");

			yield* releaseRefresh();

			yield* outcomes([
				["the heading", () => mainHeading(), "Proof"],
				["the page", () => pageAddress(), "/notes/deep/proof.md"],
			]);
		},
	);
}

screenStory.it(
	"keeps the newest source when a refresh it replaced arrives late",
	[chromeScreen(files)],
	function* ({ editFile, mainHeading, pauseRead, refreshDocument, releaseRefresh }) {
		yield* pauseRead("/notes/plan.md");
		yield* editFile("notes/plan.md", "# Older source");
		yield* refreshDocument();
		yield* editFile("notes/plan.md", "# Newest source");
		yield* refreshDocument();
		expect(yield* mainHeading()).toBe("Newest source");

		yield* releaseRefresh();

		expect(yield* mainHeading()).toBe("Newest source");
	},
);

screenStory.it(
	"shows the not-found notice and drops the file from the Library count once the open file is deleted",
	[chromeScreen(files)],
	function* ({ deleteFile, mainHeading, navigationSummary, pageNotice, refreshDocument }) {
		yield* deleteFile("notes/plan.md");
		expect(yield* mainHeading()).toBe("Plan");

		yield* refreshDocument();

		yield* outcomes([
			["the Library count", () => navigationSummary(), expect.objectContaining({ libraryCount: Object.keys(files).length - 1 })],
			["the notice", () => pageNotice(), expect.objectContaining({ description: MISSING_PLAN })],
		]);
	},
);
