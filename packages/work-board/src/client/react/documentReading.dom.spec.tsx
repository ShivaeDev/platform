import { expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import type { Document } from "#browser/document/schema.ts";
import { answerCardFixture } from "#test/answerCardFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";
import { WIDE_TABLE, WIDE_TABLE_LAYOUT } from "#test/wideTableFixture.ts";
import { ItemSummary } from "./ItemSummary.tsx";

expectNoReactWarnings();

const REPORT = `---
id: report.wide
kind: report
---
# Wide comparison

${WIDE_TABLE}`;
screenStory.it(
	"keeps prose columns of a wide document table at a readable width and short columns on one line, scrolling inside its own box",
	[routedScreen({ "home.md": "# Home", "report.md": REPORT }, "/report.md")],
	function* ({ findElement, findElements, readTableLayout }) {
		yield* eventually(() => expect(findElement("article.doc table")).not.toBeNull());
		expect(readTableLayout("article.doc table")).toEqual(WIDE_TABLE_LAYOUT);
		expect(findElements("article.doc th").map((head) => head.dataset.slot)).toEqual(["table-head", "table-head", "table-head", "table-head"]);
		expect(findElements("article.doc td").every((cell) => cell.classList.contains("[overflow-wrap:normal]"))).toBe(true);
	},
);

const NOTES = `---
id: notes.board
---
# Workspace notes

Local planning for the project.

## Plan

### Keep the source readable

Readers open the source first.

## Done

### Ship the reader
`;
screenStory.it(
	"reads the workspace notes board as prose with its columns and items in the main column",
	[routedScreen({ "notes.md": NOTES }, "/notes.md", { home: "notes.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement(".document-layout > .board")).not.toBeNull());
		const board = findElement(".document-layout > .board");
		expect(board?.classList.contains("reading-column")).toBe(true);
		expect(readText(".board-introduction p", board)).toBe("Local planning for the project.");
		expect(readText("[data-page-header]")).not.toContain("Local planning");
		expect([...findElements("section h2", board)].map((heading) => heading.textContent)).toEqual(["Plan", "Done"]);
		expect([...findElements("section article.item h3", board)].map((heading) => heading.textContent)).toEqual([
			"Keep the source readable",
			"Ship the reader",
		]);
		expect(readText("article.item p", board)).toBe("Readers open the source first.");
		expect(readText("[data-page-summary] .counts")).toBe("1 plan · 1 done");
		expect(readText("[data-page-summary]")).toMatch(/updated \S/u);
		const updated = findElement("[data-page-summary] time");
		expect(updated?.getAttribute("datetime")).toBe(new Date(Number(updated?.getAttribute("data-modified"))).toISOString());
		expect([...findElements("[data-page-summary] time[data-modified]")].map((time) => time.closest("[data-item-updated]") !== null)).toEqual([true]);
	},
);

screenStory.it(
	"keeps a workspace board without columns readable in the main column",
	[routedScreen({ "notes.md": NOTES.slice(0, NOTES.indexOf("## Plan")) }, "/notes.md", { home: "notes.md" })],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement(".document-layout > .board")).not.toBeNull());
		expect(readText(".document-layout > .board")).toBe("Local planning for the project.");
		expect(findElement("[data-page-summary] .counts")).toBeNull();
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
	"keeps the item ID muted after its kind and status and copies it on request",
	[componentScreen(<ItemSummary document={TASK} />)],
	function* ({ findElement, findElements, roles }) {
		const writeText = vi.fn(() => Promise.resolve());
		vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
		const row = findElement(".item-summary > div");
		const id = findElement('a[href="/_board/item/task.fixture/"]', row);
		expect(id?.closest(".text-muted-foreground")).not.toBeNull();
		expect(id?.classList.contains("font-mono")).toBe(true);
		const order = [...findElements("span, a", row)].map((element) => element.textContent);
		expect(order.indexOf("task")).toBeLessThan(order.indexOf("task.fixture"));
		expect(order.indexOf("Ready")).toBeLessThan(order.indexOf("task.fixture"));
		yield* roles.click({ name: "Copy item ID", role: "button" });
		yield* eventually(() => expect(findElement('button[aria-label="Copied item ID"]', row)).not.toBeNull());
		expect(writeText).toHaveBeenCalledWith("task.fixture");
	},
);

screenStory.it(
	"says answering is turned off and offers no answer controls on a Board without responses",
	[routedScreen(answerCardFixture, "/guide.md", { home: "home.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement(".response-panel li")).not.toBeNull());
		const card = findElement(".response-panel");
		expect(findElements('[role="status"]', card).map((status) => status.textContent)).toEqual(["Answering is turned off on this Board."]);
		expect(findElements("form, input, textarea, select, button, [role=radio], [role=checkbox]", card)).toEqual([]);
		expect(findElements("li", card).map((option) => option.textContent)).toEqual([
			"Publish nowRecommended — Ship the reviewed guide with this release.",
			"Wait for review — Keep the work blocked until another review.",
		]);
		expect(readText(".answer-reason", card)).toContain("Which publishing path should we take?");
	},
);
