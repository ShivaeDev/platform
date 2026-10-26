import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { highlighterStartupFails, markdownPluginFails, renderFailureStory } from "#test/renderFailureStory.ts";
import { RenderFailed } from "./Failed.ts";

const startupCause = new BadRequest({ message: "Unable to load themes" });
renderFailureStory.it(
	"keeps highlighter startup failures typed for the host",
	[highlighterStartupFails(startupCause)],
	function* ({ startHighlighter }) {
		const failure = yield* startHighlighter().pipe(Effect.flip);
		expect(failure).toBeInstanceOf(RenderFailed);
		expect(Schema.is(RenderFailed)(failure)).toBe(true);
		expect(failure.cause).toBe(startupCause);
		expect(failure.message).toContain("restart Work Board");
	},
);
const markdownCause = new BadRequest({ message: "Invalid Markdown" });
renderFailureStory.it(
	"keeps Markdown plugin failures typed for the rendering caller",
	[markdownPluginFails(markdownCause)],
	function* ({ renderFile }) {
		const failure = yield* renderFile("note.md").pipe(Effect.flip);
		expect(failure).toBeInstanceOf(RenderFailed);
		expect(failure.cause).toBe(markdownCause);
		expect(failure.message).toContain("Check the Markdown source and retry");
	},
);
