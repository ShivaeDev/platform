import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

const source = `---
id: question.source
attention:
  - id: review
    kind: review
    state: open
    reason: Which approach?
    response_from: [maintainer]
    unblocks: [question.source]
---
# Investigation

The exact reviewed proposal.
`;

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "item.md": source });
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	page = yield* openPage(board, "/_board/respond?item=question.source&request=review");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
});

function input(name: string, value: string) {
	const field = page.document.querySelector(`[name="${name}"]`);
	if (!(field instanceof page.window.HTMLInputElement || field instanceof page.window.HTMLTextAreaElement)) {
		throw new Error(`Missing ${name}`);
	}
	field.value = value;
	field.dispatchEvent(new page.window.Event("input", { bubbles: true }));
	return field;
}

function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}

it.live(
	"keeps the same owned form and its draft during initial/live page reads, then exposes a changed revision without discarding input",
	function* () {
		yield* open();
		input("author", "maintainer");
		const body = input("body", "Keep my conditions.");
		yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
		expect(page.document.querySelector('[name="body"]')).toBe(body);
		notes.write("other.md", "# Unrelated source addition");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("files")?.textContent).toContain("other")));
		expect(page.document.querySelector('[name="body"]')).toBe(body);
		expect(body.value).toBe("Keep my conditions.");
		notes.write("item.md", source.replace("The exact reviewed proposal.", "Changed reviewed proposal."));
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Source changed")));
		expect(page.document.getElementsByTagName("textarea")[0]?.value).toBe("Keep my conditions.");
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	},
);

it.live("records the previewed response through native commands and shows saved feedback without inferring acceptance", function* () {
	yield* open();
	input("author", "maintainer");
	input("body", "No; use the simpler option.");
	click("response-preview");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false)));
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("No; use the simpler option.")),
	);
	expect(page.document.getElementById("response-status")?.textContent).toContain("Saved:");
	expect(page.document.getElementById("response-status")?.textContent).toContain("not acceptance");
});
