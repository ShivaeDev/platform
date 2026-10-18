import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();
screenStory.it(
	"selects and opens the remaining result when a query refresh removes the selected third result",
	[
		searchScreen({
			"notes/first.md": "# First\n\nShared phrase one.",
			"notes/second.md": "# Second\n\nShared phrase two.",
			"notes/third.md": "# Third\n\nShared phrase three.",
		}),
	],
	function* ({ input, keyboard, editFile, refreshSearch, count, readAttribute, findElement }) {
		input("#search-query", "Shared phrase");
		yield* Effect.promise(() => eventually(() => expect(count('#search-results [role="option"]')).toBe(3)));
		keyboard("ArrowDown", {}, "#search-query");
		keyboard("ArrowDown", {}, "#search-query");
		expect(readAttribute("#search-query", "aria-activedescendant")).toBe("search-result-2");
		editFile("notes/second.md", "# Second\n\nNo match.");
		editFile("notes/third.md", "# Third\n\nNo match.");
		yield* Effect.promise(() => refreshSearch("Shared phrase"));
		yield* Effect.promise(() => eventually(() => expect(count('#search-results [role="option"]')).toBe(1)));
		expect(readAttribute("#search-query", "aria-activedescendant")).toBe("search-result-0");
		expect(readAttribute('#search-results [aria-selected="true"]', "href")).toBe("/notes/first.md#heading-first");
		const enter = keyboard("Enter", { cancelable: true }, "#search-query");
		expect(enter.defaultPrevented).toBe(true);
		expect(findElement("dialog")).toHaveProperty("returnValue", "navigate");
		expect(findElement("dialog")).toHaveProperty("open", false);
	},
);

for (const { initial, previous } of [
	{ initial: "", previous: "/" },
	{ initial: "First phrase", previous: "/notes/first.md#heading-first" },
]) {
	screenStory.it(
		`does not activate '${initial}' options when Enter follows a query edit before debounce`,
		[searchScreen({ "notes/first.md": "# First\n\nFirst phrase.", "notes/second.md": "# Second\n\nSecond phrase." })],
		function* ({ input, keyboard, submit, count, readAttribute, findElement }) {
			if (initial) {
				input("#search-query", initial);
			}
			yield* Effect.promise(() => eventually(() => expect(readAttribute('#search-results [aria-selected="true"]', "href")).toBe(previous)));
			input("#search-query", "Second phrase");
			const enter = keyboard("Enter", { cancelable: true }, "#search-query");
			expect(findElement("dialog")).toHaveProperty("open", true);
			expect(readAttribute("#search-query", "aria-activedescendant")).toBeNull();
			expect(count('#search-results [role="option"]')).toBe(0);
			expect(enter.defaultPrevented).toBe(false);
			submit("#search-form");
			yield* Effect.promise(() =>
				eventually(() => expect(readAttribute('#search-results [aria-selected="true"]', "href")).toBe("/notes/second.md#heading-second")),
			);
			expect(count('#search-results [role="option"]')).toBe(1);
			keyboard("Enter", { cancelable: true }, "#search-query");
			expect(findElement("dialog")).toHaveProperty("returnValue", "navigate");
		},
	);
}
