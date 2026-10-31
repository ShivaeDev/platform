import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { Document } from "#browser/document/schema.ts";
import { answerCardFixture } from "#test/answerCardFixture.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { WIDE_TABLE, WIDE_TABLE_LAYOUT } from "#test/wideTableFixture.ts";
import { ItemSummary } from "./ItemSummary.tsx";

expectNoReactWarnings();

const REPORT = `---
id: report.wide
kind: report
---
# Wide comparison

${WIDE_TABLE}`;
const INTRODUCTION = "---\nid: notes.board\n---\n# Workspace notes\n\nLocal planning for the project.\n";
const NOTES = `${INTRODUCTION}
## Plan

### Keep the source readable

Readers open the source first.

## Done

### Ship the reader
`;

screenStory.it(
	"a wide table in a document keeps prose columns at a readable width and short columns on one line, scrolling in its own box",
	[readingPage({ "home.md": "# Home", "report.md": REPORT }, "/report.md")],
	function* ({ readTableLayout }) {
		expect(yield* readTableLayout("article.doc table")).toEqual(WIDE_TABLE_LAYOUT);
	},
);

screenStory.it(
	"the workspace notes board reads as its introduction followed by each column with its items, and the header does not repeat the introduction",
	[readingPage({ "notes.md": NOTES }, "/notes.md", { home: "notes.md" })],
	function* ({ notesBoard, pageHeader }) {
		yield* outcomes({
			board: [
				notesBoard(),
				{
					columns: [
						{ column: "Plan", items: [{ item: "Keep the source readable", text: "Readers open the source first." }] },
						{ column: "Done", items: [{ item: "Ship the reader", text: "" }] },
					],
					introduction: "Local planning for the project.",
				},
			],
			header: [pageHeader(), expect.not.stringContaining("Local planning")],
		});
	},
);

screenStory.it(
	"the summary of the workspace notes board counts its items by column and says when the board was updated",
	[readingPage({ "notes.md": NOTES }, "/notes.md", { home: "notes.md" })],
	function* ({ boardSummary }) {
		expect(yield* boardSummary()).toEqual({ counts: "1 plan · 1 done", updated: "updated <time>" });
	},
);

screenStory.it(
	"a workspace notes board without columns shows only its introduction and no item counts",
	[readingPage({ "notes.md": INTRODUCTION }, "/notes.md", { home: "notes.md" })],
	function* ({ boardSummary, notesBoard }) {
		yield* outcomes({
			board: [notesBoard(), { columns: [], introduction: "Local planning for the project." }],
			counts: [boardSummary(), expect.objectContaining({ counts: "none" })],
		});
	},
);

const TASK: Document = {
	diagnostics: [],
	file: "task.md",
	identity: "task.fixture",
	links: {},
	metadata: { id: "task.fixture", kind: "task", status: "ready" },
	modified: 0,
	questionActions: {},
	references: {},
	requests: [],
	source: "# Readable task\n",
	unavailable: [],
	writable: false,
};

screenStory.it(
	"an item header names the item's kind and status before its ID",
	[componentScreen(<ItemSummary document={TASK} />)],
	function* ({ itemHeaderRow }) {
		expect(yield* itemHeaderRow()).toEqual(["Task", "Ready", "task.fixture", expect.stringMatching(/^updated /u)]);
	},
);

screenStory.it(
	"on a Board without responses, an answer card says answering is turned off and lists the options without answer controls",
	[readingPage(answerCardFixture, "/guide.md", { home: "home.md" })],
	function* ({ answerPanel }) {
		expect(yield* answerPanel()).toEqual({
			controls: [],
			notice: ["Answering is turned off on this Board."],
			options: [
				"Publish nowRecommended — Ship the reviewed guide with this release.",
				"Wait for review — Keep the work blocked until another review.",
			],
			question: "Which publishing path should we take? Read the release guide.",
		});
	},
);
