import { Context, Effect, Layer } from "effect";
import { createHighlighter, type Highlighter as Shiki } from "shiki";
import { RenderFailed } from "./failed.ts";

export const THEMES = { light: "github-light", dark: "github-dark" } as const;

export class Highlighter extends Context.Service<Highlighter, Shiki>()("WorkBoard/Highlighter") {
	static readonly layer = Layer.effect(Highlighter)(
		Effect.acquireRelease(
			Effect.tryPromise({
				try: () => createHighlighter({ themes: Object.values(THEMES), langs: [] }),
				catch: (cause) => new RenderFailed({ cause }),
			}),
			(highlighter) => Effect.sync(() => highlighter.dispose()),
		),
	);
}
