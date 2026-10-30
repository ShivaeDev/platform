import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { FILES } from "#test/live.ts";

describe("diagrams", () => {
	// Guards the lazy Mermaid chunk served from /_board/mermaid/.
	boardStory.it(
		"loads Mermaid only on a page with a diagram",
		[readerAt("/plan.md"), projectFiles(FILES), boardHome("board.md")],
		function* ({ board, reader, page }) {
			expect(page.mermaidRequests).toEqual([]);
			const diagram = yield* reader.open("/flow.md");
			yield* Effect.promise(() => diagram.mermaidRequested);
			expect(diagram.mermaidRequests).toEqual([`${board.url}/_board/mermaid/mermaid.esm.min.mjs`]);
		},
	);
});
