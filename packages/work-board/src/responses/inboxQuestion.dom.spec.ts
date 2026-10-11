import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { metadataParse } from "#metadata/parse.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { enterField } from "#test/enterField.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});

async function open() {
	notes = folder({ "question.md": inboxQuestion });
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	page = await openPage(board, "/_board/item/question.storage/");
	await waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false));
	enterField(page, "author", "Casey");
}
function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}
async function answer() {
	click("response-preview");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Saved:"));
	await waitFor(() => expect(page.document.getElementById("inbox-count")?.textContent).toBe("0"));
	await waitFor(() => expect(page.document.getElementById("inbox-topbar-count")?.textContent).toBe("0"));
	expect((await rawGet(board, "/_board/inbox")).body).toContain("0 waiting");
	expect(readFileSync(join(notes.root, "question.md"), "utf8")).toBe(inboxQuestion);
	const saved = readdirSync(join(notes.root, "responses")).find((file) => file.startsWith("response."));
	if (!saved) {
		throw new Error("No response saved");
	}
	return metadataParse(readFileSync(join(notes.root, "responses", saved), "utf8"));
}

it("records a recommended option from the item page and updates the live Inbox badge", async () => {
	await open();
	expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
	page.document.querySelector('[data-choice="option-1"]')?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	expect(page.document.querySelector('[data-choice="option-1"]')?.getAttribute("aria-pressed")).toBe("true");
	const response = await answer();
	expect(response.fields.kind).toBe("response");
	expect(response.fields.response?.answers?.[0]?.selected).toEqual(["option-1"]);
	expect(response.body).toContain("Keep local files");
});

it("remembers the author across questions and keeps response details collapsed with one visible answer box", async () => {
	await open();
	expect(page.document.querySelector('[data-key="response-details"]')?.hasAttribute("open")).toBe(false);
	const textareas = [...page.document.querySelectorAll("#response-form textarea")];
	expect(textareas.filter((field) => !field.closest("details"))).toHaveLength(1);
	for (const name of ["type", "supersedes", "author"]) {
		expect(page.document.querySelector(`[name="${name}"]`)?.closest("details")?.getAttribute("data-key")).toBe("response-details");
	}
	notes.write("other.md", inboxQuestion.replace("question.storage", "question.backup"));
	await waitFor(() => expect(page.document.querySelector('#files a[href="/other.md"]')).not.toBeNull());
	page.document.querySelector('#files a[href="/other.md"]')?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("response-form")?.getAttribute("data-item")).toBe("question.backup"));
	await waitFor(() => expect(page.document.querySelector('[name="author"]')).toHaveProperty("value", "Casey"));
});

it("records a free-text answer and returns an edited question to the Inbox", async () => {
	await open();
	const text = page.document.querySelector("[data-answer-text]");
	if (!(text instanceof page.window.HTMLTextAreaElement)) {
		throw new Error("Missing text answer");
	}
	text.value = "Keep files and add an export later.";
	text.dispatchEvent(new page.window.Event("input", { bubbles: true }));
	const response = await answer();
	expect(response.fields.response?.answers?.[0]).toMatchObject({ selected: [], text: "Keep files and add an export later." });
	notes.write("question.md", `${inboxQuestion}\nWhat about backups?`);
	await waitFor(() => expect(page.document.getElementById("inbox-count")?.textContent).toBe("1"));
});

it("opens a question through native Inbox navigation and refreshes a closed question out of the queue", async () => {
	await open();
	await page.close();
	page = await openPage(board, "/_board/inbox");
	await waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live"));
	expect(page.document.querySelectorAll(".inbox-row")).toHaveLength(1);
	page.document.querySelector(".inbox-row a")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("response-form")).not.toBeNull());
	expect(page.window.location.pathname).toBe("/_board/item/question.storage/");
	notes.write("question.md", inboxQuestion.replace("status: open", "status: closed"));
	await waitFor(() => expect(page.document.getElementById("inbox-count")?.textContent).toBe("0"));
	page.document.getElementById("inbox-open")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-view")).toBe("inbox"));
	expect(page.document.querySelectorAll(".inbox-row")).toHaveLength(0);
});
