import { expect } from "vitest";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { highlighterStartupFails, markdownPluginFails, renderFailureStory } from "#test/renderFailureStory.ts";

renderFailureStory.it(
	"a highlighter that cannot load its themes fails startup as a render failure that keeps its cause and asks for a restart",
	[highlighterStartupFails(new BadRequest({ message: "Unable to load themes" }))],
	function* ({ hostStartsHighlighter }) {
		expect(yield* hostStartsHighlighter()).toEqual({
			carriesCause: true,
			failure: "render failed",
			message: expect.stringContaining("restart Work Board"),
		});
	},
);

renderFailureStory.it(
	"a Markdown plugin that rejects the source fails rendering as a render failure that keeps its cause and asks to check the source",
	[markdownPluginFails(new BadRequest({ message: "Invalid Markdown" }))],
	function* ({ rendererRenders }) {
		expect(yield* rendererRenders("note.md")).toEqual({
			carriesCause: true,
			failure: "render failed",
			message: expect.stringContaining("Check the Markdown source and retry"),
		});
	},
);
