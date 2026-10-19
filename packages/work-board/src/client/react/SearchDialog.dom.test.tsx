import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { unavailableWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();
const QUERY = '#search-dialog [role="combobox"]';
const OPTIONS = '#search-dialog [role="option"]';
const STATUS = '#search-dialog [role="status"]';
const SELECTED = '#search-dialog [role="option"][aria-selected="true"] a';
screenStory.it(
	"names and opens the remaining result when a query refresh removes the selected third result",
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
		yield* Effect.promise(() =>
			eventually(() => expect(readAttribute(QUERY, "aria-activedescendant", document)).toBe(findElements(OPTIONS, document)[0]?.id)),
		);
		keyboard("ArrowDown", {}, QUERY);
		keyboard("ArrowDown", {}, QUERY);
		yield* Effect.promise(() =>
			eventually(() => expect(readAttribute(QUERY, "aria-activedescendant", document)).toBe(findElements(OPTIONS, document)[2]?.id)),
		);
		expect(findElement(`${OPTIONS}[aria-selected="true"]`, document)?.id).toBe(readAttribute(QUERY, "aria-activedescendant", document));
		editFile("notes/second.md", "# Second\n\nNo match.");
		editFile("notes/third.md", "# Third\n\nNo match.");
		yield* Effect.promise(() => refreshSearch("Shared phrase"));
		yield* Effect.promise(() => eventually(() => expect(count(OPTIONS, document)).toBe(1)));
		yield* Effect.promise(() => eventually(() => expect(readAttribute(SELECTED, "href", document)).toBe("/notes/first.md")));
		yield* Effect.promise(() =>
			eventually(() => expect(readAttribute(QUERY, "aria-activedescendant", document)).toBe(findElements(OPTIONS, document)[0]?.id)),
		);
		const enter = keyboard("Enter", { cancelable: true }, QUERY);
		expect(enter.defaultPrevented).toBe(true);
		yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
	},
);

for (const { initial, previous } of [
	{ initial: "", previous: "/" },
	{ initial: "First phrase", previous: "/notes/first.md" },
]) {
	screenStory.it(
		`searches instead of activating '${initial}' options when Enter follows a query edit before debounce`,
		[searchScreen({ "notes/first.md": "# First\n\nFirst phrase.", "notes/second.md": "# Second\n\nSecond phrase." })],
		function* ({ input, keyboard, count, readAttribute, findElement, freezeTimers }) {
			if (initial) {
				input(QUERY, initial);
			}
			yield* Effect.promise(() => eventually(() => expect(readAttribute(SELECTED, "href", document)).toBe(previous)));
			freezeTimers(() => {
				input(QUERY, "Second phrase");
				expect(count(OPTIONS, document)).toBe(0);
				expect(readAttribute(QUERY, "aria-activedescendant", document)).toBeNull();
				keyboard("Enter", { cancelable: true }, QUERY);
			});
			expect(findElement("#search-dialog", document)).not.toBeNull();
			yield* Effect.promise(() => eventually(() => expect(readAttribute(SELECTED, "href", document)).toBe("/notes/second.md")));
			expect(count(OPTIONS, document)).toBe(1);
			keyboard("Enter", { cancelable: true }, QUERY);
			yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
		},
	);
}

screenStory.it(
	"retries a failed search from its status",
	[searchScreen({ "notes/first.md": "# First\n\nShared phrase one." }), unavailableWorkspace()],
	function* ({ input, recoverWorkspace, count, readText, roles }) {
		input(QUERY, "Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(readText(STATUS, document)).toBe("Search could not be completed.")));
		recoverWorkspace();
		yield* roles.click({ name: "Retry search", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(count(OPTIONS, document)).toBe(1)));
		expect(readText(STATUS, document)).toBe("1 matches.");
	},
);

screenStory.it(
	"keeps the selected result when Home and End move the caret in the query",
	[searchScreen({ "notes/first.md": "# First\n\nShared phrase one.", "notes/second.md": "# Second\n\nShared phrase two." })],
	function* ({ input, keyboard, count, findElement, findElements }) {
		input(QUERY, "Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(count(OPTIONS, document)).toBe(2)));
		keyboard("ArrowDown", {}, QUERY);
		const selected = findElements(OPTIONS, document)[1]?.id;
		expect(findElement(`${OPTIONS}[aria-selected="true"]`, document)?.id).toBe(selected);
		keyboard("Home", { cancelable: true }, QUERY);
		expect(findElement(`${OPTIONS}[aria-selected="true"]`, document)?.id).toBe(selected);
		keyboard("End", { cancelable: true }, QUERY);
		expect(findElement(`${OPTIONS}[aria-selected="true"]`, document)?.id).toBe(selected);
	},
);
