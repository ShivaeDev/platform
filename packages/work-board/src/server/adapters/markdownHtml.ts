import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownAsync } from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { Highlighter } from "shiki";
import type { PluggableList } from "unified";
import { codeBlocks } from "#adapters/code.ts";
import { documentLinks } from "#render/documentLinks.ts";
import { documentPlugins } from "#render/documentPlugins.ts";
import { footnoteIds } from "#render/footnoteIds.ts";
import type { RenderOptions } from "#server/render/markdown.ts";

export async function markdownHtml(highlighter: Highlighter, source: string, options: RenderOptions) {
	const plugins: PluggableList = [...(options.safe ? [] : [rehypeRaw]), codeBlocks(highlighter)];
	if (options.idPrefix !== undefined) {
		plugins.push(footnoteIds(options.idPrefix));
	}
	if (options.file !== undefined) {
		plugins.push(documentLinks(options.file));
	}
	if (options.headings !== undefined) {
		plugins.push(options.headings.plugin);
	}
	return renderToStaticMarkup(
		await MarkdownAsync({
			children: source,
			components: { img: ({ node: _node, ...props }) => createElement("img", { ...props, loading: "lazy" }) },
			rehypePlugins: plugins,
			remarkPlugins: documentPlugins(options.questionActions),
			skipHtml: options.safe,
		}),
	);
}
