import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

const SOURCE = "---\nid: task.focus\nkind: task\nnext_action: Inspect focus\n---\n# Focus\n\nReviewed source.\n";
let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});
async function open(clipboardDenied = false) {
	notes = folder({ "item.md": SOURCE });
	board = await startBoard(notes.root, undefined, undefined, true);
	page = await openPage(board, "/_board/handoff?item=task.focus", (window) => {
		if (clipboardDenied) {
			Object.defineProperty(window.navigator, "clipboard", {
				value: {
					writeText: () => Promise.reject(new Error("Denied")),
				},
			});
		}
	});
	await waitFor(() => expect(page.document.getElementById("handoff-preview")?.hasAttribute("disabled")).toBe(false));
}
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
it("preserves the owned handoff draft on live reads and requires preview after a changed reviewed source", async () => {
	await open();
	input("recipient", "agent-local");
	const goal = input("goal", "Keep my direction.");
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
	expect(page.document.querySelector('[name="goal"]')).toBe(goal);
	notes.write("unrelated.md", "# Another file\n");
	await waitFor(() => expect(page.document.getElementById("files")?.textContent).toContain("unrelated"));
	expect(page.document.querySelector('[name="goal"]')).toBe(goal);
	click("handoff-preview");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
	notes.write("item.md", SOURCE.replace("Reviewed source.", "Changed premise."));
	await waitFor(() => expect(page.document.querySelector(".response-context")?.textContent).toContain("Changed premise"));
	expect(fieldValue("goal")).toBe("Keep my direction.");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
});
it("prepares through native commands and retains the selected manual-copy prompt when clipboard access is unavailable", async () => {
	await open(true);
	input("recipient", "agent-local");
	input("goal", "Fix focus");
	click("handoff-preview");
	page.document.getElementById("handoff-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("handoff-status")?.textContent).toContain("Prepared:"));
	expect(page.document.getElementById("handoff-status")?.textContent).toContain("execution and acceptance remain separate");
	const button = page.document.querySelector("#handoff-prepared [data-handoff-copy]");
	button?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	await waitFor(() => expect(page.document.querySelector("#handoff-prepared [data-copy-status]")?.textContent).toContain("selected"));
	const field = page.document.querySelector("#handoff-prepared textarea");
	if (!(field instanceof page.window.HTMLTextAreaElement)) {
		throw new Error("Missing copy prompt");
	}
	expect(field?.value).toContain("Record receipt");
	expect(field?.selectionStart).toBe(0);
	expect(field?.selectionEnd).toBe(field?.value.length);
});
it("uses native navigation and restores a handoff draft across Back without losing the browser session", async () => {
	await open();
	input("recipient", "agent-local");
	input("goal", "Retain this direction across navigation");
	await waitFor(() => expect(page.window.history.state).toHaveProperty("workBoard.id"));
	page.document.body.dataset.visit = "kept";
	const link = page.document.querySelector('#files a[href="/item.md"]');
	link?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	await waitFor(() => expect(page.document.querySelector('a[href="/_board/handoff?item=task.focus"]')).not.toBeNull());
	page.document
		.querySelector('a[href="/_board/handoff?item=task.focus"]')
		?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	await waitFor(() => expect(fieldValue("goal")).toBe("Retain this direction across navigation"));
	expect(page.document.body.dataset.visit).toBe("kept");
	expect(fieldValue("goal")).toBe("Retain this direction across navigation");
	page.window.history.back();
	await waitFor(() => expect(page.document.querySelector('a[href="/_board/handoff?item=task.focus"]')).not.toBeNull());
	page.window.history.back();
	await waitFor(() => expect(fieldValue("goal")).toBe("Retain this direction across navigation"));
	expect(fieldValue("goal")).toBe("Retain this direction across navigation");
});
