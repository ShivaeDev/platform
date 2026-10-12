import { createElement, Fragment } from "react";
import { type Components, MarkdownHooks } from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { Document } from "#browser/document/schema.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { documentLinks } from "#render/documentLinks.ts";
import { documentPlugins } from "#render/documentPlugins.ts";
import { footnoteIds } from "#render/footnotes.ts";
import { highlightDocument } from "./highlight.ts";
import { Mermaid } from "./Mermaid.ts";

const components: Components = {
	code: ({ node: _node, className, children, ...props }) =>
		className?.split(" ").includes("language-mermaid")
			? createElement(Mermaid, { source: String(children) })
			: createElement("code", { ...props, className }, children),
	img: ({ node: _node, ...props }) => createElement("img", { ...props, loading: "lazy" }),
	pre: ({ node, children, ...props }) => {
		const code = node?.children[0];
		return code?.type === "element" && Array.isArray(code.properties.className) && code.properties.className.includes("language-mermaid")
			? createElement(Fragment, null, children)
			: createElement("pre", props, children);
	},
};

export interface DocumentViewProps {
	readonly document: Document;
	readonly idPrefix?: string;
}

export function DocumentView({ document, idPrefix = "" }: DocumentViewProps) {
	return createElement(
		"article",
		{ className: "doc" },
		createElement(
			MarkdownHooks,
			{
				components,
				rehypePlugins: [
					rehypeRaw,
					highlightDocument,
					footnoteIds(idPrefix),
					documentLinks(document.file, document.links),
					documentHeadings(true).plugin,
				],
				remarkPlugins: documentPlugins(new Map(Object.entries(document.questionActions))),
			},
			document.source,
		),
	);
}
