import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const SOURCE = "# Page-free reading\n\nThe server still reads project documents.";
const MISSING_READER = "refused: The story has no bundle page. Add the readerAt(path) reader trait before reading page or opening through reader.";

boardStory.it(
	"without a reader trait, the board still serves documents and the bundle page names the missing trait",
	[projectFiles({ "note.md": SOURCE })],
	function* ({ bundlePage, documentAt, tryOpenReader }) {
		yield* outcomes({
			document: [documentAt("/note.md"), SOURCE],
			page: [bundlePage(), MISSING_READER],
			reader: [tryOpenReader("/note.md"), MISSING_READER],
		});
	},
);
