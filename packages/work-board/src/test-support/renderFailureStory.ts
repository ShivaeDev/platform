import "#test/adapters/renderFaults.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { RenderFailed } from "#render/Failed.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { RenderOptions } from "#server/render/markdown.ts";
import { observeRenderers, themeLoadingFails } from "#test/adapters/renderFaults.ts";
import { type BoardEngine, createBoard } from "./storyEngine.ts";

interface RenderEngine extends BoardEngine {
	cause?: unknown;
	highlighter?: Context.Service.Shape<typeof Highlighter>;
	options?: RenderOptions;
	released?: () => readonly string[];
	scope: Scope.Closeable;
}

function outcome<A>(engine: RenderEngine, result: Effect.Effect<A, unknown>) {
	return result.pipe(
		Effect.match({
			onFailure: (failure) =>
				failure instanceof RenderFailed
					? { carriesCause: failure.cause === engine.cause, failure: "render failed", message: failure.message }
					: { failure: "untyped", message: String(failure) },
			onSuccess: (content) => ({ content, failure: "none" }),
		}),
	);
}
export const renderFailureStory = storyKit({
	clock: "live",
	*create() {
		const engine: RenderEngine = { ...(yield* createBoard()), scope: yield* Scope.fork(yield* Scope.Scope) };
		engine.notes.write("note.md", "```ts\nconst answer = 42\n```");
		return engine;
	},
	inspect: (engine) => ({ root: engine.notes.root }),
	name: "board renderer",
	stages: ["project"],
	verbs: (engine, story) => ({
		hostStartsHighlighter: () => {
			story.tell("the host starts a scoped Markdown renderer");
			return outcome(
				engine,
				Layer.buildWithScope(Highlighter.layer, engine.scope).pipe(
					Effect.tap((context) =>
						Effect.sync(() => {
							engine.highlighter = Context.get(context, Highlighter);
						}),
					),
					Effect.asVoid,
				),
			);
		},
		releasedRenderers: () => {
			story.tell("the host reads how many renderers were disposed");
			return Effect.sync(() => engine.released?.() ?? []);
		},
		rendererRenders: (file: string) => {
			story.tell(`the renderer renders ${file}`);
			return outcome(engine, renderer(engine).markdown(readFileSync(join(engine.notes.root, file), "utf8"), engine.options));
		},
		rendererStops: () => {
			story.tell("the host closes the renderer's scope");
			return Scope.close(engine.scope, Exit.void);
		},
	}),
});

function renderer(engine: RenderEngine) {
	if (!engine.highlighter) {
		throw new Error("The renderer has not started");
	}
	return engine.highlighter;
}

export function highlighterStartupFails(cause: unknown) {
	return renderFailureStory.trait("project", "the highlighter cannot load its themes", (engine) => {
		engine.cause = cause;
		themeLoadingFails(cause);
	});
}
export function markdownPluginFails(cause: unknown) {
	return renderFailureStory.trait("project", "a Markdown plugin rejects the source", (engine) => {
		engine.cause = cause;
		engine.options = {
			headings: {
				entries: [],
				plugin: () => () => {
					throw cause;
				},
			},
		};
	});
}
export function codeLoadingFails(cause: unknown) {
	return renderFailureStory.trait("project", "a code language cannot load", (engine) => {
		engine.cause = cause;
		engine.released = observeRenderers(cause);
	});
}
export const rendererDisposalObserved = renderFailureStory.trait("project", "the renderer records its disposal", (engine) => {
	engine.released = observeRenderers();
});
