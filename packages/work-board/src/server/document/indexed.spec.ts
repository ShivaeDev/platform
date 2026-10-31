import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { indexedWorkspace } from "#test/indexedWorkspace.ts";
import { recordedReads } from "#test/readTraits.ts";
import { countedMetadataWork, fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

boardStory.it(
	"opening indexed documents by RPC and HTTP reads only those files and neither parses metadata nor rebuilds the model",
	[projectFiles(indexedWorkspace), fleetAcceptsEveryBrief, recordedReads(), countedMetadataWork],
	function* ({ boardFinishesIndexing, getPage, metadataWork, readDocument, readFiles }) {
		yield* boardFinishesIndexing();

		for (const file of ["document-1.md", "document-2.md", "document-10.md"]) {
			yield* readDocument(file);
		}
		const page = yield* getPage("/document-3.md");

		expect(page.body).toContain("data-board-react-root");
		expect(readFiles()).toEqual(["document-1.md", "document-2.md", "document-10.md", "document-3.md"]);
		expect(yield* metadataWork()).toEqual({ modelBuilds: 0, modelUpdates: 0, parses: 0 });
	},
);

boardStory.it(
	"a document opened from the index still lists the item that depends on it and the note that links to it",
	[projectFiles(indexedWorkspace), fleetAcceptsEveryBrief],
	function* ({ boardFinishesIndexing, documentBacklinks }) {
		yield* boardFinishesIndexing();

		expect(yield* documentBacklinks("document-1.md")).toEqual(["/_board/item/fixture.0/", "/_board/item/fixture.159/"]);
	},
);
