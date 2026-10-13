import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { chrome, click, control, input } from "#test/chrome.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("retains the search query and refreshed results after dismissal and reopening", async () => {
	const files = { "notes/plan.md": "# Plan\n\nShared phrase.\n" };
	const view = await chrome(files);
	try {
		click("#search-open");
		input("#search-query", "Shared phrase");
		await eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase."));
		act(() =>
			control("#search-query", HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" })),
		);
		await eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false));
		click("#search-open");
		expect(control("#search-query", HTMLInputElement).value).toBe("Shared phrase");
		await eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase."));
		files["notes/plan.md"] = "# Plan\n\nShared phrase changed.\n";
		await act(async () => view.registry.refresh(view.api.search.query({ query: "Shared phrase" })));
		await eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase changed."));
		click("#search-close");
		await eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false));
		click("#search-open");
		expect(control("#search-query", HTMLInputElement).value).toBe("Shared phrase");
		await eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase changed."));
	} finally {
		await view.unmount();
	}
});

it.each(["ctrlKey", "metaKey"] as const)("restores textarea focus and selection after %s+K and Escape", async (modifier) => {
	const view = await chrome(
		{ "question.md": "---\nid: question.fixture\nkind: question\nstatus: open\n---\n# A choice\n\nChoose a direction.\n" },
		"/question.md",
	);
	try {
		await eventually(() => expect(document.querySelector("#response-form textarea")).not.toBeNull());
		const textarea = control("#response-form textarea", HTMLTextAreaElement);
		act(() => {
			textarea.value = "Work in progress";
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		});
		textarea.focus();
		textarea.setSelectionRange(4, 8, "backward");
		act(() => textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "k", [modifier]: true })));
		expect(control("#search-dialog", HTMLDialogElement).open).toBe(true);
		expect(document.activeElement).toBe(control("#search-query", HTMLInputElement));
		const focus = textarea.focus.bind(textarea);
		vi.spyOn(textarea, "focus").mockImplementation((options) => {
			focus(options);
			textarea.setSelectionRange(0, 0);
		});
		act(() =>
			control("#search-query", HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" })),
		);
		await eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false));
		await eventually(() => expect(document.activeElement).toBe(textarea));
		expect(textarea.value).toBe("Work in progress");
		expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection]).toEqual([4, 8, "backward"]);
	} finally {
		await view.unmount();
	}
});
