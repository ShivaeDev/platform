import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { enterField } from "#test/enterField.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { anAnswerForm } from "#test/storyTraits.ts";

const RESPONSE_PATH = "/_board/respond?item=investigation.choices&request=direction";

boardStory.it(
	"names missing prompts and author beside their controls and clears each corrected warning without losing answers",
	[
		projectFiles({ "proposal.md": questionnaireSource }, "a project source awaits direction"),
		responsesEnabled(),
		readerAt(RESPONSE_PATH),
		anAnswerForm(),
	],
	function* ({ page, reader }) {
		const status = page.document.getElementById("response-status");
		yield* formEvent(page, () => enterField(page, "author", ""));
		expect(status?.textContent).not.toContain("Add your local author label.");
		yield* reader.submit("response-form");
		expect(status?.textContent).toContain("Question 1 · display; Question 2 · checks");
		expect(page.document.querySelector('[name="author"]')?.closest("details")?.getAttribute("data-key")).toBe("response-details");
		const display = reader.answer("display", "Retain the complete history.");
		const checks = reader.answer("checks", "Test reload and keyboard use.");
		yield* reader.preview();
		expect(status?.textContent).toContain("Add your local author label.");
		expect(page.document.querySelector('[name="author"] + .response-field-error')?.textContent).toBe("Add your local author label.");
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
		yield* reader.submit("response-form");
		expect(display.value).toBe("Retain the complete history.");
		expect(checks.value).toBe("Test reload and keyboard use.");
		expect(page.document.activeElement).toBe(page.document.querySelector('[name="author"]'));
		yield* formEvent(page, () => enterField(page, "author", "reviewer"));
		expect(status?.textContent).not.toContain("Add your local author");
		yield* formEvent(page, () => reader.answer("checks", ""));
		yield* reader.preview();
		expect(status?.textContent).toContain("Unanswered prompts: Question 2 · checks.");
		expect(status?.textContent).not.toContain("Question 1 · display");
		expect(page.document.querySelector('[data-prompt="checks"] .response-field-error')?.textContent).toContain("Unanswered: Question 2 · checks");
		yield* formEvent(page, () => reader.answer("checks", "Test reload and keyboard use."));
		expect(status?.textContent).not.toContain("Unanswered");
		yield* reader.preview();
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	},
);
boardStory.it(
	"keeps pasted text, focus and cursor through a source update and restores the whole draft and author after reload",
	[
		projectFiles({ "proposal.md": questionnaireSource }, "a project source awaits direction"),
		responsesEnabled(),
		readerAt(RESPONSE_PATH),
		anAnswerForm(),
	],
	function* ({ page, reader, editFile }) {
		yield* formEvent(page, () => enterField(page, "author", "reviewer"));
		yield* formEvent(page, () => enterField(page, "body", "Overall conditions"));
		const display = reader.answer("display", "Pasted multiline\nanswer");
		yield* formEvent(page, () => reader.answer("checks", "Keyboard checks"));
		display.focus();
		display.setSelectionRange(7, 16, "backward");
		editFile("proposal.md", `${questionnaireSource}\nNew context.\n`);
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Source changed")));
		const restored = page.document.querySelector('[data-prompt="display"] textarea');
		expect(restored).toHaveProperty("value", "Pasted multiline\nanswer");
		expect(page.document.activeElement).toBe(restored);
		expect(restored).toHaveProperty("selectionStart", 7);
		expect(restored).toHaveProperty("selectionEnd", 16);
		expect(restored).toHaveProperty("selectionDirection", "backward");
		yield* formEvent(page, () => reader.answer("display", "Pasted multiline\nanswer continued"));
		const storage = page.window.localStorage;
		const saved = Array.from({ length: storage.length }, (_, index) => {
			const key = storage.key(index) ?? "";
			return [key, storage.getItem(key) ?? ""] as const;
		});
		page = yield* reader.open(RESPONSE_PATH, (window) => {
			for (const [key, value] of saved) {
				window.localStorage.setItem(key, value);
			}
		});
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
		expect(page.document.querySelector('[data-prompt="display"] textarea')).toHaveProperty("value", "Pasted multiline\nanswer continued");
		expect(page.document.querySelector('[data-prompt="checks"] textarea')).toHaveProperty("value", "Keyboard checks");
		expect(page.document.querySelector('[name="body"]')).toHaveProperty("value", "Overall conditions");
		expect(page.document.querySelector('[name="author"]')).toHaveProperty("value", "reviewer");
		yield* reader.preview();
		yield* reader.submit("response-form");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Saved:")));
		const authorKey = saved.find(([key]) => key.startsWith("work-board:author:"));
		page = yield* reader.open(RESPONSE_PATH, (window) => {
			if (authorKey) {
				window.localStorage.setItem(...authorKey);
			}
		});
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
		expect(page.document.querySelector('[name="author"]')).toHaveProperty("value", "reviewer");
		expect(page.document.querySelector('[data-prompt="display"] textarea')).toHaveProperty("value", "");
	},
);
boardStory.it(
	"rebinds a cached page without duplicate error labels or stale warnings",
	[
		projectFiles({ "proposal.md": questionnaireSource }, "a project source awaits direction"),
		responsesEnabled(),
		readerAt(RESPONSE_PATH),
		anAnswerForm(),
	],
	function* ({ page, reader }) {
		yield* formEvent(page, () => reader.answer("display", "Keep history."));
		yield* reader.preview();
		yield* formEvent(page, () => page.window.dispatchEvent(new page.window.Event("pagehide")));
		yield* formEvent(page, () => page.window.dispatchEvent(Object.assign(new page.window.Event("pageshow"), { persisted: true })));
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-form")?.closest("[hidden]")).toBeNull()));
		yield* formEvent(page, () => enterField(page, "author", "reviewer"));
		yield* formEvent(page, () => reader.answer("checks", "Keyboard checks."));
		expect(page.document.querySelectorAll(".response-field-error:not([hidden])")).toHaveLength(0);
		const messages = [...page.document.querySelectorAll(".response-field-error")];
		expect(new Set(messages.map((message) => message.id)).size).toBe(messages.length);
		expect(page.document.getElementById("response-status")?.textContent).not.toContain("Unanswered");
		expect(page.document.getElementById("response-status")?.textContent).not.toContain("Add your local author");
	},
);
