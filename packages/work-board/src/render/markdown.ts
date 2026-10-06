import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownAsync } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { codeBlocks } from "./code.ts";
import type { documentHeadings } from "./documentHeadings.ts";
import { documentLinks } from "./documentLinks.ts";
import { RenderFailed } from "./failed.ts";
import { footnoteIds } from "./footnotes.ts";
import { Highlighter } from "./highlighter.ts";

export interface RenderOptions {
	readonly file?: string;
	readonly headings?: ReturnType<typeof documentHeadings>;
	readonly idPrefix?: string;
}

export const renderMarkdown = Effect.fn("WorkBoard.renderMarkdown")(function* (source: string, options: RenderOptions = {}) {
	const highlighter = yield* Highlighter;
	const plugins: PluggableList = [rehypeRaw, codeBlocks(highlighter)];
	if (options.idPrefix !== undefined) {
		plugins.push(footnoteIds(options.idPrefix));
	}
	if (options.file !== undefined) {
		plugins.push(documentLinks(options.file));
	}
	if (options.headings !== undefined) {
		plugins.push(options.headings.plugin);
	}
	const html = yield* Effect.tryPromise({
		catch: (cause) => new RenderFailed({ cause }),
		try: async () =>
			renderToStaticMarkup(
				await MarkdownAsync({
					children: source,
					components: { img: ({ node: _node, ...props }) => createElement("img", { ...props, loading: "lazy" }) },
					rehypePlugins: plugins,
					remarkPlugins: [remarkGfm],
				}),
			),
	});
	return html;
});
