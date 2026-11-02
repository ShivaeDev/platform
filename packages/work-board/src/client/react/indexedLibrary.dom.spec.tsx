import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"the Library lists an edited document by its newly indexed title",
	[routedScreen({ "note.md": "# Before" }, "/_board/library")],
	function* ({ editFile, libraryTitles, refreshLibrary }) {
		expect(yield* libraryTitles()).toEqual(["Before"]);

		yield* editFile("note.md", "# After");
		yield* refreshLibrary();

		expect(yield* libraryTitles()).toEqual(["After"]);
	},
);
