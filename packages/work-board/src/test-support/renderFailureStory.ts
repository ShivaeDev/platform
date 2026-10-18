import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Context, Effect, Layer } from "effect";
import * as shiki from "shiki";
import { afterEach, vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { type BoardEngine, createBoard } from "./storyEngine.ts";

vi.mock("shiki", async (importOriginal) => {
	const actual = await importOriginal<typeof import("shiki")>();
	return { ...actual, createHighlighter: vi.fn(actual.createHighlighter) };
});
afterEach(() => vi.restoreAllMocks());

interface RenderEngine extends BoardEngine {
	highlighter?: Context.Service.Shape<typeof Highlighter>;
}
export const renderFailureStory = storyKit({
	clock: "live",
	*create() {
		const engine: RenderEngine = yield* createBoard();
		return engine;
	},
	inspect: (engine) => ({ root: engine.notes.root }),
	name: "board renderer",
	stages: ["project"],
	verbs: (engine, story) => ({
		renderFile: (file: string) => {
			story.tell(`the renderer reads ${file}`);
			if (!engine.highlighter) {
				throw new Error("No highlighter boundary was supplied");
			}
			return renderMarkdown(readFileSync(join(engine.notes.root, file), "utf8")).pipe(Effect.provideService(Highlighter, engine.highlighter));
		},
		startHighlighter: () => {
			story.tell("the host starts the Markdown highlighter");
			return Layer.build(Highlighter.layer);
		},
	}),
});
export function highlighterStartupFails(cause: unknown) {
	return renderFailureStory.trait("project", "the highlighter cannot load its themes", () => {
		vi.mocked(shiki.createHighlighter).mockRejectedValueOnce(cause);
	});
}
export function markdownPluginFails(cause: unknown) {
	return renderFailureStory.trait("project", "a Markdown plugin rejects the source", (engine) => {
		engine.notes.write("note.md", "# Note");
		engine.highlighter = {
			codeBlocks: () =>
				Effect.succeed(() => () => {
					throw cause;
				}),
		};
	});
}
