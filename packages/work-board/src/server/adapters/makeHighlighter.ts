import { Effect } from "effect";
import { createHighlighter } from "shiki";
import { THEMES } from "#adapters/code.ts";
import { RenderFailed } from "#render/Failed.ts";
import type { RenderOptions } from "#server/render/markdown.ts";
import { markdownHtml } from "./markdownHtml.ts";

export const makeHighlighter = Effect.acquireRelease(
	Effect.tryPromise({
		catch: (cause) => new RenderFailed({ cause }),
		try: () => createHighlighter({ langs: [], themes: Object.values(THEMES) }),
	}),
	(highlighter) => Effect.sync(() => highlighter.dispose()),
).pipe(
	Effect.map((highlighter) => ({
		markdown: (source: string, options: RenderOptions = {}) =>
			Effect.tryPromise({
				catch: (cause) => new RenderFailed({ cause }),
				try: () => markdownHtml(highlighter, source, options),
			}),
	})),
);
