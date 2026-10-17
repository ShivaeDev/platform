import { Effect } from "effect";
import { createHighlighter } from "shiki";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { codeBlocks, THEMES } from "#render/code.ts";
import { RenderFailed } from "#render/Failed.ts";

export const Highlighter = defineService({
	id: "WorkBoard/Highlighter",
	initialize: Effect.acquireRelease(
		Effect.tryPromise({
			catch: (cause) => new RenderFailed({ cause }),
			try: () => createHighlighter({ langs: [], themes: Object.values(THEMES) }),
		}),
		(highlighter) => Effect.sync(() => highlighter.dispose()),
	),
	methods: (highlighter) => ({ codeBlocks: () => Effect.succeed(codeBlocks(highlighter)) }),
	requires: [],
});
export type Highlighter = typeof Highlighter.Identifier;
