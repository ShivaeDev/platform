import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { silentWatch } from "#test/faults.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});

it("retains the response draft and exposes the precise real HTTP rejection when source changes after preview", async () => {
	notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	board = await startBoard(notes.root, undefined, silentWatch, true);
	page = await openPage(board, "/_board/respond?item=item.edge&request=direction");
	await waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false));
	enterField(page, "author", "reviewer");
	const body = enterField(page, "body", "Retain these conditions.");
	page.document.getElementById("response-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed context.\n`);
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("response-status")?.getAttribute("data-outcome")).toBe("rejected"));
	expect(page.document.getElementById("response-status")?.textContent).toBe(
		"Rejected: ResponseFailed: Source changed since review. Read it again before registering this question.. Draft retained. Preview and retry with the same identity; saved content will be reconciled.",
	);
	expect(body.value).toBe("Retain these conditions.");
});

it("retains handoff direction and exposes the precise real HTTP rejection when source changes after preview", async () => {
	notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	board = await startBoard(notes.root, undefined, silentWatch, true);
	page = await openPage(board, "/_board/handoff?item=item.edge");
	await waitFor(() => expect(page.document.getElementById("handoff-preview")?.hasAttribute("disabled")).toBe(false));
	enterField(page, "recipient", "agent-local");
	const goal = enterField(page, "goal", "Retain this direction.");
	page.document.getElementById("handoff-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
	notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed context.\n`);
	page.document.getElementById("handoff-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("handoff-status")?.textContent).toContain("Rejected:"));
	expect(page.document.getElementById("handoff-status")?.textContent).toBe(
		"Rejected: ResponseFailed: The source changed or moved. Keep your draft and review it again.. Draft retained; preview and retry.",
	);
	expect(goal.value).toBe("Retain this direction.");
});
