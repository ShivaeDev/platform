import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { silentWatch } from "#test/faults.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

it.live("retains the response draft and exposes the precise real HTTP rejection when source changes after preview", function* () {
	notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	board = yield* startBoard(notes.root, undefined, silentWatch, true);
	page = yield* openPage(board, "/_board/respond?item=item.edge&request=direction");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
	enterField(page, "author", "reviewer");
	const body = enterField(page, "body", "Retain these conditions.");
	page.document.getElementById("response-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed context.\n`);
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.getAttribute("data-outcome")).toBe("rejected")));
	expect(page.document.getElementById("response-status")?.textContent).toBe(
		"Rejected: PreconditionFailed: Source changed since review. Read it again before registering this question.. Draft retained. Preview and retry with the same identity; saved content will be reconciled.",
	);
	expect(body.value).toBe("Retain these conditions.");
});

it.live("retains handoff direction and requires a fresh preview when source changes after preview", function* () {
	notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	board = yield* startBoard(notes.root, undefined, undefined, true);
	page = yield* openPage(board, "/_board/handoff?item=item.edge");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("handoff-preview")?.hasAttribute("disabled")).toBe(false)));
	enterField(page, "recipient", "agent-local");
	enterField(page, "goal", "Retain this direction.");
	page.document.getElementById("handoff-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
	notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed context.\n`);
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".response-context")?.textContent).toContain("Changed context.")));
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
	expect(page.document.getElementById("handoff-status")?.textContent).toBe(
		"Source changed since this draft. Your text is retained; review the new source and preview to bind it to this revision.",
	);
	expect(page.document.querySelector('[name="goal"]')).toHaveProperty("value", "Retain this direction.");
	expect(page.document.querySelector('[name="recipient"]')).toHaveProperty("value", "agent-local");
	page.document.getElementById("handoff-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
});
