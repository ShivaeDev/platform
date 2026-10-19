import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { selectionResetOnFocus } from "#test/browserMotion.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const QUERY = '#search-dialog [role="combobox"]';
const RESULT = '#search-dialog [role="option"] p';

const files = { "notes/plan.md": "# Plan\n\nShared phrase.\n" };
screenStory.it(
	"retains the search query and refreshed results after dismissal and reopening",
	[chromeScreen(files)],
	function* ({ click, input, control, keyboard, refreshQuery, editFile, findElement, roles }) {
		click("#search-open");
		input(QUERY, "Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control(RESULT, HTMLElement).textContent).toBe("Shared phrase.")));
		keyboard("Escape", { cancelable: true }, control(QUERY, HTMLInputElement));
		yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
		click("#search-open");
		expect(control(QUERY, HTMLInputElement).value).toBe("Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control(RESULT, HTMLElement).textContent).toBe("Shared phrase.")));
		editFile("notes/plan.md", "# Plan\n\nShared phrase changed.\n");
		yield* Effect.promise(() => refreshQuery("search", { query: "Shared phrase" }));
		yield* Effect.promise(() => eventually(() => expect(control(RESULT, HTMLElement).textContent).toBe("Shared phrase changed.")));
		yield* roles.click({ name: "Close", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
		click("#search-open");
		expect(control(QUERY, HTMLInputElement).value).toBe("Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(control(RESULT, HTMLElement).textContent).toBe("Shared phrase changed.")));
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
		function* ({ control, keyboard, findElement, readFocus, typeText, selectText, readTextSelection }) {
			yield* Effect.promise(() => eventually(() => expect(findElement("#response-form textarea")).not.toBeNull()));
			const textarea = control("#response-form textarea", HTMLTextAreaElement);
			typeText(textarea, "Work in progress");
			selectText(textarea, 4, 8, "backward");
			keyboard("k", { cancelable: true, [modifier]: true }, textarea);
			expect(findElement("#search-dialog", document)).not.toBeNull();
			yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(control(QUERY, HTMLInputElement))));

			keyboard("Escape", { cancelable: true }, control(QUERY, HTMLInputElement));
			yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
			yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(textarea)));
			expect(textarea.value).toBe("Work in progress");
			expect(readTextSelection("#response-form textarea")).toEqual([4, 8, "backward"]);
		},
	);
}
