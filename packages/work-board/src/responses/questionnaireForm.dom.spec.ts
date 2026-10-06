import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({
		"proposal.md": `${questionnaireSource}\n<form id="forged"><input name="author" value="forged"></form>\n<script>globalThis.forged = true</script>\n`,
	});
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	page = await openPage(board, "/_board/respond?item=investigation.choices&request=direction");
	await waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false));
}
function text(selector: string, value: string) {
	const input = page.document.querySelector(selector);
	if (!(input instanceof page.window.HTMLInputElement || input instanceof page.window.HTMLTextAreaElement)) {
		throw new Error(selector);
	}
	input.value = value;
	input.dispatchEvent(new page.window.Event("input", { bubbles: true }));
}
function choice(value: string) {
	const input = page.document.querySelector(`input[value="${value}"]`);
	if (!(input instanceof page.window.HTMLInputElement)) {
		throw new Error(value);
	}
	input.checked = true;
	input.dispatchEvent(new page.window.Event("input", { bubbles: true }));
}
function preview() {
	page.document.getElementById("response-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}
it("renders safe rich context and enables one batch only when every prompt has a choice or human text", async () => {
	await open();
	expect(page.document.querySelectorAll("fieldset[data-prompt]")).toHaveLength(2);
	expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
	expect(page.document.querySelector("#forged")).toBeNull();
	expect(page.document.querySelector(".response-context strong")?.textContent).toBe("reasoning");
	await waitFor(() => expect(page.mermaid.calls.length).toBeGreaterThan(0));
	text('[name="author"]', "maintainer");
	choice("history");
	preview();
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	text('[data-prompt="checks"] textarea', "None of these; test keyboard use instead.");
	preview();
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	expect(page.document.getElementById("response-preview-content")?.textContent).toContain('"prompt": "checks"');
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("test keyboard use instead"));
	expect(page.document.getElementById("response-status")?.textContent).toContain("not acceptance");
});
it("retains human text but clears selections when the template changes, exposing a recoverable earlier packet", async () => {
	await open();
	text('[name="author"]', "maintainer");
	choice("history");
	text('[data-prompt="display"] textarea', "Keep this rationale.");
	notes.write("proposal.md", questionnaireSource.replace("Full history", "Changed meaning of the same option"));
	await waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Source changed"));
	expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
	expect(page.document.querySelector('[data-prompt="display"] textarea')).toHaveProperty("value", "Keep this rationale.");
	expect(page.document.getElementById("response-draft-recovery")?.textContent).toContain("history");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
});
