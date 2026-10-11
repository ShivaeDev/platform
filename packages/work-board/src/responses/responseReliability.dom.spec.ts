import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { enterField } from "#test/enterField.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
const RESPONSE_PATH = "/_board/respond?item=investigation.choices&request=direction";
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({ "proposal.md": questionnaireSource });
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	page = await openPage(board, RESPONSE_PATH);
	await waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false));
}
function answer(prompt: string, value: string) {
	const field = page.document.querySelector(`[data-prompt="${prompt}"] textarea`);
	if (!(field instanceof page.window.HTMLTextAreaElement)) {
		throw new Error(prompt);
	}
	field.value = value;
	field.dispatchEvent(new page.window.Event("input", { bubbles: true }));
	return field;
}
function preview() {
	page.document.getElementById("response-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}
it("names missing prompts and author beside their controls and clears each corrected warning without losing answers", async () => {
	await open();
	const status = page.document.getElementById("response-status");
	expect(status?.textContent).toContain("Question 1 · display; Question 2 · checks");
	expect(page.document.querySelector('[name="author"]')?.closest("details")).toBeNull();
	const display = answer("display", "Retain the complete history.");
	const checks = answer("checks", "Test reload and keyboard use.");
	preview();
	expect(status?.textContent).toContain("Add your local author label.");
	expect(page.document.querySelector('[name="author"] + .response-field-error')?.textContent).toBe("Add your local author label.");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	expect(display.value).toBe("Retain the complete history.");
	expect(checks.value).toBe("Test reload and keyboard use.");
	expect(page.document.activeElement).toBe(page.document.querySelector('[name="author"]'));
	enterField(page, "author", "reviewer");
	expect(status?.textContent).not.toContain("Add your local author");
	answer("checks", "");
	preview();
	expect(status?.textContent).toContain("Unanswered prompts: Question 2 · checks.");
	expect(status?.textContent).not.toContain("Question 1 · display");
	expect(page.document.querySelector('[data-prompt="checks"] .response-field-error')?.textContent).toContain("Unanswered: Question 2 · checks");
	answer("checks", "Test reload and keyboard use.");
	expect(status?.textContent).not.toContain("Unanswered");
	preview();
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
});
it("keeps pasted text, focus and cursor through a source update and restores the whole draft and author after reload", async () => {
	await open();
	enterField(page, "author", "reviewer");
	enterField(page, "body", "Overall conditions");
	const display = answer("display", "Pasted multiline\nanswer");
	answer("checks", "Keyboard checks");
	display.focus();
	display.setSelectionRange(7, 16, "backward");
	notes.write("proposal.md", `${questionnaireSource}\nNew context.\n`);
	await waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Source changed"));
	const restored = page.document.querySelector('[data-prompt="display"] textarea');
	expect(restored).toHaveProperty("value", "Pasted multiline\nanswer");
	expect(page.document.activeElement).toBe(restored);
	expect(restored).toHaveProperty("selectionStart", 7);
	expect(restored).toHaveProperty("selectionEnd", 16);
	expect(restored).toHaveProperty("selectionDirection", "backward");
	answer("display", "Pasted multiline\nanswer continued");
	const storage = page.window.localStorage;
	const saved = Array.from({ length: storage.length }, (_, index) => {
		const key = storage.key(index) ?? "";
		return [key, storage.getItem(key) ?? ""] as const;
	});
	await page.close();
	page = await openPage(board, RESPONSE_PATH, (window) => {
		for (const [key, value] of saved) {
			window.localStorage.setItem(key, value);
		}
	});
	await waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false));
	expect(page.document.querySelector('[data-prompt="display"] textarea')).toHaveProperty("value", "Pasted multiline\nanswer continued");
	expect(page.document.querySelector('[data-prompt="checks"] textarea')).toHaveProperty("value", "Keyboard checks");
	expect(page.document.querySelector('[name="body"]')).toHaveProperty("value", "Overall conditions");
	expect(page.document.querySelector('[name="author"]')).toHaveProperty("value", "reviewer");
	preview();
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Saved:"));
	const authorKey = saved.find(([key]) => key.startsWith("work-board:author:"));
	await page.close();
	page = await openPage(board, RESPONSE_PATH, (window) => {
		if (authorKey) {
			window.localStorage.setItem(...authorKey);
		}
	});
	await waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false));
	expect(page.document.querySelector('[name="author"]')).toHaveProperty("value", "reviewer");
	expect(page.document.querySelector('[data-prompt="display"] textarea')).toHaveProperty("value", "");
});
