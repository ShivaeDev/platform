import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();
const QUERY = '#search-dialog [role="combobox"]';
const OPTIONS = '#search-dialog [role="option"]';
const SELECTED = '#search-dialog [role="option"][aria-selected="true"] a';
screenStory.it(
	"selects and opens the remaining result when a query refresh removes the selected third result",
	[
		searchScreen({
			"notes/first.md": "# First\n\nShared phrase one.",
			"notes/second.md": "# Second\n\nShared phrase two.",
			"notes/third.md": "# Third\n\nShared phrase three.",
		}),
	],
	function* ({ input, keyboard, editFile, refreshSearch, count, readAttribute, findElement, findElements }) {
		input(QUERY, "Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(count(OPTIONS, document)).toBe(3)));
		keyboard("ArrowDown", { bubbles: true }, QUERY);
		keyboard("ArrowDown", { bubbles: true }, QUERY);
		yield* Effect.promise(() =>
			eventually(() => expect(readAttribute(QUERY, "aria-activedescendant", document)).toBe(findElements(OPTIONS, document)[2]?.id)),
		);
		editFile("notes/second.md", "# Second\n\nNo match.");
		editFile("notes/third.md", "# Third\n\nNo match.");
		yield* Effect.promise(() => refreshSearch("Shared phrase"));
		yield* Effect.promise(() => eventually(() => expect(count(OPTIONS, document)).toBe(1)));
		yield* Effect.promise(() => eventually(() => expect(readAttribute(SELECTED, "href", document)).toBe("/notes/first.md#heading-first")));
		const enter = keyboard("Enter", { bubbles: true, cancelable: true }, QUERY);
		expect(enter.defaultPrevented).toBe(true);
		yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
	},
);

for (const { initial, previous } of [
	{ initial: "", previous: "/" },
	{ initial: "First phrase", previous: "/notes/first.md#heading-first" },
]) {
	screenStory.it(
		`searches instead of activating '${initial}' options when Enter follows a query edit before debounce`,
		[searchScreen({ "notes/first.md": "# First\n\nFirst phrase.", "notes/second.md": "# Second\n\nSecond phrase." })],
		function* ({ input, keyboard, count, readAttribute, findElement }) {
			if (initial) {
				input(QUERY, initial);
			}
			yield* Effect.promise(() => eventually(() => expect(readAttribute(SELECTED, "href", document)).toBe(previous)));
			input(QUERY, "Second phrase");
			expect(count(OPTIONS, document)).toBe(0);
			expect(readAttribute(QUERY, "aria-activedescendant", document)).toBeNull();
			keyboard("Enter", { bubbles: true, cancelable: true }, QUERY);
			expect(findElement("#search-dialog", document)).not.toBeNull();
			yield* Effect.promise(() => eventually(() => expect(readAttribute(SELECTED, "href", document)).toBe("/notes/second.md#heading-second")));
			expect(count(OPTIONS, document)).toBe(1);
			keyboard("Enter", { bubbles: true, cancelable: true }, QUERY);
			yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
		},
	);
}
