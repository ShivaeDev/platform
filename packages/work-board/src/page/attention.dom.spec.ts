import { afterEach, beforeEach, expect, it } from "vitest";
import { attentionFixture } from "#test/attentionFixture.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
beforeEach(async () => {
	notes = folder(attentionFixture());
	board = await startBoard(notes.root, "legacy.md");
});
afterEach(async () => {
	await page?.close();
	await board.stop();
	notes.remove();
});
function click(selector: string) {
	const target = page.document.querySelector(selector);
	if (!target) {
		throw new Error(`Missing ${selector}`);
	}
	target.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}

it("opens the overview from legacy Markdown and preserves queue reading context across source navigation and Back", async () => {
	page = await openPage(board, "/");
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
	click("#overview-open");
	await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-view")).toBe("overview"));
	expect(page.document.getElementById("overview-open")?.getAttribute("aria-current")).toBe("page");
	page.document.querySelector(".view-issues")?.setAttribute("open", "");
	click('[data-request="keyboard-review"] h3 a');
	await waitFor(() => expect(page.document.activeElement?.id).toBe("attention-request-keyboard-review"));
	expect(page.document.getElementById("overview-open")?.getAttribute("aria-current")).toBe("false");
	expect(page.document.getElementById("attention-request-keyboard-review")?.textContent).toContain("marvin, agent-navigation");
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
	click('#attention-request-keyboard-review a[href="/_board/item/work.search/#criterion-keyboard"]');
	await waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-keyboard"));
	page.window.history.back();
	await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("request.search"));
	page.window.history.back();
	await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-view")).toBe("overview"));
	expect(page.document.querySelector(".view-issues")?.hasAttribute("open")).toBe(true);
	expect(page.document.getElementById("overview-open")?.getAttribute("aria-current")).toBe("page");
});

it("updates explicit open requests in place and keeps issue disclosure open during source edits", async () => {
	page = await openPage(board, "/_board/overview");
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
	page.document.querySelector(".view-issues")?.setAttribute("open", "");
	notes.write("attention/review.md", (attentionFixture()["attention/review.md"] ?? "").replaceAll("state: open", "state: closed"));
	await waitFor(() => expect(page.document.querySelectorAll(".attention-card").length).toBe(1));
	expect(page.document.querySelector(".view-issues")?.hasAttribute("open")).toBe(true);
	expect(page.document.querySelector(".attention-total")?.textContent).toBe("1 validated open request");
	notes.write("attention/blocker.md", (attentionFixture()["attention/blocker.md"] ?? "").replace("work.search#keyboard", "missing.id"));
	await waitFor(() => expect(page.document.querySelectorAll(".attention-card").length).toBe(0));
	expect(page.document.querySelector(".view-issues")?.textContent).toContain("Unresolved reference missing.id");
	expect(page.document.querySelector(".attention-total")?.textContent).not.toContain("All quiet");
});
