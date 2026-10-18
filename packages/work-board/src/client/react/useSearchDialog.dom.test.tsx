import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
beforeEach(() => {
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

screenStory.it(
	"retains the search query and refreshed results after dismissal and reopening",
	[],
	function* ({ chrome, click, input, control, keyboard }) {
		const files = { "notes/plan.md": "# Plan\n\nShared phrase.\n" };
		const view = yield* Effect.promise(() => chrome(files));

		click("#search-open");
		input("#search-query", "Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase.")));
		keyboard("Escape", { bubbles: true, cancelable: true }, control("#search-query", HTMLInputElement));
		yield* Effect.promise(() => eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false)));
		click("#search-open");
		expect(control("#search-query", HTMLInputElement).value).toBe("Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase.")));
		files["notes/plan.md"] = "# Plan\n\nShared phrase changed.\n";
		yield* Effect.promise(() => act(async () => view.registry.refresh(view.api.search.query({ query: "Shared phrase" }))));
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase changed.")));
		click("#search-close");
		yield* Effect.promise(() => eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false)));
		click("#search-open");
		expect(control("#search-query", HTMLInputElement).value).toBe("Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase changed.")));
	},
);

for (const modifier of ["ctrlKey", "metaKey"] as const) {
	screenStory.it(
		`restores textarea focus and selection after ${modifier}+K and Escape`,
		[
			chromeScreen(
				{ "question.md": "---\nid: question.fixture\nkind: question\nstatus: open\n---\n# A choice\n\nChoose a direction.\n" },
				"/question.md",
			),
		],
		function* ({ control, keyboard }) {
			yield* Effect.promise(() => eventually(() => expect(document.querySelector("#response-form textarea")).not.toBeNull()));
			const textarea = control("#response-form textarea", HTMLTextAreaElement);
			act(() => {
				textarea.value = "Work in progress";
				textarea.dispatchEvent(new Event("input", { bubbles: true }));
			});
			textarea.focus();
			textarea.setSelectionRange(4, 8, "backward");
			keyboard("k", { bubbles: true, cancelable: true, [modifier]: true }, textarea);
			expect(control("#search-dialog", HTMLDialogElement).open).toBe(true);
			expect(document.activeElement).toBe(control("#search-query", HTMLInputElement));
			const focus = textarea.focus.bind(textarea);
			vi.spyOn(textarea, "focus").mockImplementation((options) => {
				focus(options);
				textarea.setSelectionRange(0, 0);
			});
			keyboard("Escape", { bubbles: true, cancelable: true }, control("#search-query", HTMLInputElement));
			yield* Effect.promise(() => eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false)));
			yield* Effect.promise(() => eventually(() => expect(document.activeElement).toBe(textarea)));
			expect(textarea.value).toBe("Work in progress");
			expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection]).toEqual([4, 8, "backward"]);
		},
	);
}
