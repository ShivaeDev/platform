import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { selectionResetOnFocus } from "#test/browserMotion.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"reopening Search after Escape shows the same query and its results",
	[chromeScreen({ "notes/plan.md": "# Plan\n\nShared phrase.\n" })],
	function* ({ openSearch, pressInSearch, results, searchFor, searchQuery }) {
		yield* openSearch();
		yield* searchFor("Shared phrase");
		yield* pressInSearch("Escape");

		yield* openSearch();

		yield* outcomes({
			query: [searchQuery(), "Shared phrase"],
			results: [results("snippet"), [{ snippet: "Shared phrase." }]],
		});
	},
);

const QUESTION = "---\nid: question.fixture\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\n---\n# A choice\n\nChoose a direction.\n";

for (const modifier of ["Ctrl", "Cmd"] as const) {
	screenStory.it(
		`Escape from Search opened with ${modifier}+K in an answer returns focus to the answer with its text and backward selection`,
		[chromeScreen({ "question.md": QUESTION }, "/question.md", { writable: true }), selectionResetOnFocus()],
		function* ({ focusedField, openSearchWithShortcut, pressInSearch, searchDialog, selectText, typeText }) {
			yield* typeText("#response-form textarea", "Work in progress");
			yield* selectText("#response-form textarea", 4, 8, "backward");
			yield* openSearchWithShortcut(modifier);
			expect(yield* searchDialog()).toBe("open");

			yield* pressInSearch("Escape");

			expect(yield* focusedField()).toEqual({ selection: [4, 8, "backward"], value: "Work in progress" });
		},
	);
}
