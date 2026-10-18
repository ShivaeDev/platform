import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { selectionResetOnFocus } from "#test/browserMotion.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = { "notes/plan.md": "# Plan\n\nShared phrase.\n" };
screenStory.it(
	"retains the search query and refreshed results after dismissal and reopening",
	[chromeScreen(files)],
	function* ({ click, input, control, keyboard, refreshQuery, editFile }) {
		click("#search-open");
		input("#search-query", "Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase.")));
		keyboard("Escape", { bubbles: true, cancelable: true }, control("#search-query", HTMLInputElement));
		yield* Effect.promise(() => eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false)));
		click("#search-open");
		expect(control("#search-query", HTMLInputElement).value).toBe("Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Shared phrase.")));
		editFile("notes/plan.md", "# Plan\n\nShared phrase changed.\n");
		yield* Effect.promise(() => refreshQuery("search", { query: "Shared phrase" }));
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
			selectionResetOnFocus(),
		],
		function* ({ control, keyboard, findElement, readFocus, typeText }) {
			yield* Effect.promise(() => eventually(() => expect(findElement("#response-form textarea")).not.toBeNull()));
			const textarea = control("#response-form textarea", HTMLTextAreaElement);
			typeText(textarea, "Work in progress");
			textarea.focus();
			textarea.setSelectionRange(4, 8, "backward");
			keyboard("k", { bubbles: true, cancelable: true, [modifier]: true }, textarea);
			expect(control("#search-dialog", HTMLDialogElement).open).toBe(true);
			expect(readFocus()).toBe(control("#search-query", HTMLInputElement));

			keyboard("Escape", { bubbles: true, cancelable: true }, control("#search-query", HTMLInputElement));
			yield* Effect.promise(() => eventually(() => expect(control("#search-dialog", HTMLDialogElement).open).toBe(false)));
			yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(textarea)));
			expect(textarea.value).toBe("Work in progress");
			expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection]).toEqual([4, 8, "backward"]);
		},
	);
}
