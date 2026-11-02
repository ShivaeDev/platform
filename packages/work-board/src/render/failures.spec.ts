import { expect } from "vitest";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	codeLoadingFails,
	highlighterStartupFails,
	markdownPluginFails,
	rendererDisposalObserved,
	renderFailureStory,
} from "#test/renderFailureStory.ts";

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
	function* ({ hostStartsHighlighter, rendererRenders }) {
		yield* hostStartsHighlighter();

		expect(yield* rendererRenders("note.md")).toEqual({
			carriesCause: true,
			failure: "render failed",
			message: expect.stringContaining("Check the Markdown source and retry"),
		});
	},
);

renderFailureStory.it(
	"a code language that cannot load fails rendering with its cause and is disposed with its scope",
	[codeLoadingFails(new Error("Language unavailable"))],
	function* ({ hostStartsHighlighter, rendererRenders, rendererStops, releasedRenderers }) {
		yield* hostStartsHighlighter();

		expect(yield* rendererRenders("note.md")).toEqual({
			carriesCause: true,
			failure: "render failed",
			message: expect.stringContaining("Check the Markdown source"),
		});

		yield* rendererStops();

		expect(yield* releasedRenderers()).toEqual(["Markdown highlighter"]);
	},
);

renderFailureStory.it(
	"a renderer remains alive while in use and is disposed when its scope closes",
	[rendererDisposalObserved],
	function* ({ hostStartsHighlighter, rendererRenders, rendererStops, releasedRenderers }) {
		yield* hostStartsHighlighter();

		yield* outcomes([
			["rendered content", () => rendererRenders("note.md"), { content: expect.stringContaining('class="shiki'), failure: "none" }],
			["disposal before closing the scope", () => releasedRenderers(), []],
		]);

		yield* rendererStops();

		expect(yield* releasedRenderers()).toEqual(["Markdown highlighter"]);
	},
);
