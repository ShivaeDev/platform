import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"opens search with the keyboard and chooses a passage under a duplicate heading",
	[chromeScreen({ "home.md": "# Home", "notes/plan.md": "# Plan\n\n## Evidence\n\nKnown phrase.\n\n## Evidence\n\nSecond phrase." })],
	function* ({ focus, keyboard, input, findElement, location, readFocus }) {
		focus("#search-open");
		keyboard("k", { ctrlKey: true });
		yield* eventually(() => expect(readFocus()).toBe(findElement('#search-dialog [role="combobox"]', document)));
		input('#search-dialog [role="combobox"]', "second phrase");
		yield* eventually(() =>
			expect(findElement('#search-dialog [role="option"] a', document)?.getAttribute("href")).toBe("/notes/plan.md#heading-evidence-2"),
		);
		keyboard("Enter", {}, '#search-dialog [role="combobox"]');
		yield* eventually(() => expect(location()?.hash).toBe("heading-evidence-2"));
		yield* eventually(() => expect(findElement("#search-dialog", document)).toBeNull());
		yield* eventually(() => expect(readFocus()?.id).toBe("heading-evidence-2"));
	},
);
screenStory.it(
	"activates a palette command with Enter and restores the search opener's focus",
	[chromeScreen(chromeFixture())],
	function* ({ focus, click, input, keyboard, findElement, readAttribute, readFocus }) {
		focus("#search-open");
		click("#search-open");
		input('#search-dialog [role="combobox"]', "sidebar");
		yield* eventually(() =>
			expect(findElement('#search-dialog [aria-selected="true"]', document)?.getAttribute("data-command")).toBe("sidebar-toggle"),
		);
		keyboard("Enter", {}, '#search-dialog [role="combobox"]');
		yield* eventually(() => expect(findElement("#search-dialog", document)).toBeNull());
		expect(readAttribute("#sidebar-toggle", "aria-expanded")).toBe("false");
		yield* eventually(() => expect(readFocus()?.id).toBe("search-open"));
	},
);
