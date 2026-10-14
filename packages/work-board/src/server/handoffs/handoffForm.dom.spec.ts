import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { followLink } from "#test/followLink.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";

const SOURCE = "---\nid: task.focus\nkind: task\nnext_action: Inspect focus\n---\n# Focus\n\nReviewed source.\n";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* (clipboardDenied = false) {
	notes = folder({ "item.md": SOURCE });
	board = yield* startBoard(notes.root, undefined, undefined, true);
	page = yield* openPage(board, "/_board/handoff?item=task.focus", (window) => {
		if (clipboardDenied) {
			Object.defineProperty(window.navigator, "clipboard", {
				value: {
					writeText: () => Promise.reject(new Error("Denied")),
				},
			});
		}
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("handoff-preview")?.hasAttribute("disabled")).toBe(false)));
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

function fieldValue(name: string) {
	const field = page.document.querySelector(`[name="${name}"]`);
	return field instanceof page.window.HTMLTextAreaElement ? field.value : undefined;
}

function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}

it.live("preserves the owned handoff draft on live reads and requires preview after a changed reviewed source", function* () {
	yield* open();
	input("recipient", "agent-local");
	const goal = input("goal", "Keep my direction.");
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	expect(page.document.querySelector('[name="goal"]')).toBe(goal);
	notes.write("unrelated.md", "# Another file\n");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("documents-open")?.textContent).toBe("Library2")));
	expect(page.document.querySelector('[name="goal"]')).toBe(goal);
	yield* formEvent(page, () => click("handoff-preview"));
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
	notes.write("item.md", SOURCE.replace("Reviewed source.", "Changed premise."));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".response-context")?.textContent).toContain("Changed premise")));
	expect(fieldValue("goal")).toBe("Keep my direction.");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
});

it.live("prepares through native commands and retains the selected manual-copy prompt when clipboard access is unavailable", function* () {
	yield* open(true);
	input("recipient", "agent-local");
	input("goal", "Fix focus");
	yield* formEvent(page, () => click("handoff-preview"));
	yield* formEvent(page, () =>
		page.document.getElementById("handoff-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true })),
	);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("handoff-status")?.textContent).toContain("Prepared:")));
	expect(page.document.getElementById("handoff-status")?.textContent).toContain("execution and acceptance remain separate");
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#handoff-prepared [data-handoff-copy]")).not.toBeNull()));
	const button = page.document.querySelector("#handoff-prepared [data-handoff-copy]");
	yield* formEvent(page, () => button?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true })));
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.querySelector("#handoff-prepared [data-copy-status]")?.textContent).toContain("selected")),
	);
	const field = page.document.querySelector("#handoff-prepared textarea");
	if (!(field instanceof page.window.HTMLTextAreaElement)) {
		throw new Error("Missing copy prompt");
	}
	expect(field?.value).toContain("Record receipt");
	expect(field?.selectionStart).toBe(0);
	expect(field?.selectionEnd).toBe(field?.value.length);
});

it.live("uses native navigation and restores a handoff draft across Back without losing the browser session", function* () {
	yield* open();
	input("recipient", "agent-local");
	input("goal", "Retain this direction across navigation");
	yield* Effect.promise(() => waitFor(() => expect(page.window.history.state).toHaveProperty("workBoard.id")));
	page.document.body.dataset.visit = "kept";
	yield* formEvent(page, () => followLink(page, "/item.md"));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('a[href="/_board/handoff?item=task.focus"]')).not.toBeNull()));
	yield* formEvent(page, () =>
		page.document
			.querySelector('a[href="/_board/handoff?item=task.focus"]')
			?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true })),
	);
	yield* Effect.promise(() => waitFor(() => expect(fieldValue("goal")).toBe("Retain this direction across navigation")));
	expect(page.document.body.dataset.visit).toBe("kept");
	expect(fieldValue("goal")).toBe("Retain this direction across navigation");
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('a[href="/_board/handoff?item=task.focus"]')).not.toBeNull()));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(fieldValue("goal")).toBe("Retain this direction across navigation")));
	expect(fieldValue("goal")).toBe("Retain this direction across navigation");
});
