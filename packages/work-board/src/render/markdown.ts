import { Effect } from "effect";
import { markdownToHtml } from "satteri";
import { codeBlocks } from "./code.ts";
import { RenderFailed } from "./failed.ts";
import { footnoteIds } from "./footnotes.ts";
import { Highlighter } from "./highlighter.ts";

export const renderMarkdown = Effect.fn("WorkBoard.renderMarkdown")(function* (source: string, idPrefix = "") {
	const highlighter = yield* Highlighter;
	const { html } = yield* Effect.tryPromise({
		try: async () =>
			markdownToHtml(source, { hastPlugins: idPrefix === "" ? [codeBlocks(highlighter)] : [codeBlocks(highlighter), footnoteIds(idPrefix)] }),
		catch: (cause) => new RenderFailed({ cause }),
	});
	return html;
});
