import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Context, Effect, Layer } from "effect";
import * as shiki from "shiki";
import { afterEach, vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { RenderFailed } from "#render/Failed.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { type BoardEngine, createBoard } from "./storyEngine.ts";

vi.mock("shiki", async (importOriginal) => {
	const actual = await importOriginal<typeof import("shiki")>();
	return { ...actual, createHighlighter: vi.fn(actual.createHighlighter) };
});
afterEach(() => vi.restoreAllMocks());

interface RenderEngine extends BoardEngine {
	cause?: unknown;
	highlighter?: Context.Service.Shape<typeof Highlighter>;
}

function outcome(engine: RenderEngine, result: Effect.Effect<unknown, unknown, never>) {
	return result.pipe(
		Effect.as({ failure: "none" }),
		Effect.catch((failure: unknown) =>
			Effect.succeed(
				failure instanceof RenderFailed
					? { carriesCause: failure.cause === engine.cause, failure: "render failed", message: failure.message }
					: { failure: "untyped", message: String(failure) },
			),
		),
	);
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
		hostStartsHighlighter: () => {
			story.tell("the host starts the Markdown highlighter and reads how it failed");
			return outcome(engine, Effect.scoped(Layer.build(Highlighter.layer)));
		},
		rendererRenders: (file: string) => {
			story.tell(`the renderer renders ${file} and the caller reads how it failed`);
			if (!engine.highlighter) {
				throw new Error("No highlighter boundary was supplied");
			}
			return outcome(
				engine,
				renderMarkdown(readFileSync(join(engine.notes.root, file), "utf8")).pipe(Effect.provideService(Highlighter, engine.highlighter)),
			);
		},
	}),
});
export function highlighterStartupFails(cause: unknown) {
	return renderFailureStory.trait("project", "the highlighter cannot load its themes", (engine) => {
		engine.cause = cause;
		vi.mocked(shiki.createHighlighter).mockRejectedValueOnce(cause);
	});
}
export function markdownPluginFails(cause: unknown) {
	return renderFailureStory.trait("project", "a Markdown plugin rejects the source", (engine) => {
		engine.cause = cause;
		engine.notes.write("note.md", "# Note");
		engine.highlighter = {
			codeBlocks: () =>
				Effect.succeed(() => () => {
					throw cause;
				}),
		};
	});
}
