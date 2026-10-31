import { expect } from "vitest";
import { boardHome, boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { FILES } from "#test/live.ts";

boardStory.it(
	"the built page fetches Mermaid from the Board's own path only once the reader opens a page with a diagram",
	[readerAt("/plan.md"), projectFiles(FILES), boardHome("board.md")],
	function* ({ mermaidLoads, mermaidModules, reader }) {
		expect(yield* mermaidModules()).toEqual([]);

		yield* reader.open("/flow.md");

		yield* mermaidLoads();
		expect(yield* mermaidModules()).toEqual(["/_board/mermaid/mermaid.esm.min.mjs"]);
	},
);
