import { expect } from "vitest";
import { disappearsBeforeStat, fileReadingStory, readableFiles } from "#test/fileReadingStory.ts";

fileReadingStory.it(
	"a home that disappears between resolution and stat is reported missing with advice to choose another",
	[readableFiles({ "home.md": "# Home" }), disappearsBeforeStat("home.md")],
	function* ({ homeSelection, root }) {
		expect(yield* homeSelection("home.md")).toBe(
			`home missing: The home file home.md is not a markdown file in ${root}. Choose an existing Markdown file with --home.`,
		);
	},
);

fileReadingStory.it(
	"listing skips a file that disappears before stat and keeps the readable one",
	[readableFiles({ "gone.md": "# Removed", "kept.md": "# Readable" }), disappearsBeforeStat("gone.md")],
	function* ({ listedPaths }) {
		expect(yield* listedPaths()).toEqual(["kept.md"]);
	},
);
