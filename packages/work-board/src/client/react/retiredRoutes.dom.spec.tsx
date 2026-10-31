import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = { "note.md": "# Note", "result.md": "---\nid: result.note\nkind: report\n---\n# Returned note\n" };

for (const [route, target, heading] of [
	["overview", "/", "Today"],
	["inbox", "/", "Today"],
	["changes", "/_board/library?view=recently-changed", "Library"],
	["diagnostics", "/_board/system", "System"],
	["result?item=result.note", "/_board/item/result.note/", "Returned note"],
	["result", "/_board/library?kind=result", "Library"],
] as const) {
	screenStory.it(
		`sends the retired /_board/${route} to ${target}`,
		[routedScreen(files, `/_board/${route}`)],
		function* ({ currentPage, mainHeading }) {
			yield* outcomes({
				"the heading": [mainHeading(), heading],
				"the page": [currentPage(), target],
			});
		},
	);
}

screenStory.it(
	"opens the retired /_board/changes on the Library's Recently changed view",
	[routedScreen(files, "/_board/changes")],
	function* ({ libraryFilters }) {
		expect((yield* libraryFilters()).view).toBe("Recently changed");
	},
);
