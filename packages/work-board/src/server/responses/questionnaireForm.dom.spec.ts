import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({
		"proposal.md": `${questionnaireSource}\n<form id="forged"><input name="author" value="forged"></form>\n<script>globalThis.forged = true</script>\n`,
	});
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	page = yield* openPage(board, "/_board/respond?item=investigation.choices&request=direction");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
});

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

it.live("keeps authored markup outside answer controls and records one batch when every prompt has a choice or human text", function* () {
	yield* open();
	expect(page.document.querySelectorAll("fieldset[data-prompt]")).toHaveLength(2);
	expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
	expect(page.document.querySelector(".answer-cards #forged")).toBeNull();
	expect(page.document.querySelector("article.doc strong")?.textContent).toBe("reasoning");
	yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls.length).toBeGreaterThan(0)));
	text('[name="author"]', "maintainer");
	yield* formEvent(page, () => choice("history"));
	yield* formEvent(page, () => preview());
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	text('[data-prompt="checks"] textarea', "None of these; test keyboard use instead.");
	yield* formEvent(page, () => preview());
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	expect(page.document.getElementById("response-preview-content")?.textContent).toContain('"prompt": "checks"');
	yield* formEvent(page, () =>
		page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true })),
	);
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("test keyboard use instead")),
	);
	expect(page.document.getElementById("response-status")?.textContent).toContain("not acceptance");
});

it.live("retains human text but clears selections when the template changes, exposing a recoverable earlier packet", function* () {
	yield* open();
	text('[name="author"]', "maintainer");
	yield* formEvent(page, () => choice("history"));
	text('[data-prompt="display"] textarea', "Keep this rationale.");
	notes.write("proposal.md", questionnaireSource.replace("Full history", "Changed meaning of the same option"));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Source changed")));
	expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
	expect(page.document.querySelector('[data-prompt="display"] textarea')).toHaveProperty("value", "Keep this rationale.");
	expect(page.document.getElementById("response-draft-recovery")?.textContent).toContain("history");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
});
