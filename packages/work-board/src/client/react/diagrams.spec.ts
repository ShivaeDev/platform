import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { figure } from "#test/diagramObservation.ts";
import { FILES, waitFor } from "#test/live.ts";

describe("diagrams", () => {
	// Guards the lazy Mermaid chunk served from /_board/mermaid/.
	boardStory.it(
		"loads Mermaid only on a page with a diagram",
		[readerAt("/plan.md"), projectFiles(FILES), boardHome("board.md")],
		function* ({ board, reader, page: initialPage }) {
			let page = initialPage;
			expect(page.mermaidRequests).toEqual([]);
			page = yield* reader.open("/flow.md");
			yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
			expect(page.mermaidRequests).toEqual([`${board.url}/_board/mermaid/mermaid.esm.min.mjs`]);
		},
	);
});
