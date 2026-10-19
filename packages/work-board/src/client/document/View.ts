import { createElement, Fragment, type ReactNode, useMemo } from "react";
import { type Components, MarkdownHooks } from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { PluggableList } from "unified";
import type { Document } from "#browser/document/schema.ts";
import { AgeLabel } from "#client/react/AgeLabel.tsx";
import { documentHeadings } from "#render/documentHeadings.ts";
import { documentLinks } from "#render/documentLinks.ts";
import { documentPlugins } from "#render/documentPlugins.ts";
import { footnoteIds } from "#render/footnoteIds.ts";
import { boardLayout } from "./boardLayout.ts";
import { DetailStatesContext, DocumentDetails } from "./Details.ts";
import { highlightDocument } from "./highlight.ts";
import { documentLayout, documentSourceId } from "./layout.ts";
import { LayoutContext, layoutElements } from "./layoutElements.ts";
import { Mermaid } from "./Mermaid.ts";

const components: Components = {
	code: ({ node: _node, className, children, ...props }) =>
		className?.split(" ").includes("language-mermaid")
			? createElement(Mermaid, { source: String(children) })
			: createElement("code", { ...props, className }, children),
	details: DocumentDetails,
	img: ({ node: _node, ...props }) => createElement("img", { ...props, loading: "lazy" }),
	pre: ({ node, children, ...props }) => {
		const code = node?.children[0];
		return code?.type === "element" && Array.isArray(code.properties.className) && code.properties.className.includes("language-mermaid")
			? createElement(Fragment, null, children)
			: createElement("pre", props, children);
	},
	span: ({ node, children, ...props }) => {
		const modified = node?.properties.dataModified ?? node?.properties["data-modified"];
		if (modified !== undefined && props.className?.split(" ").includes("age")) {
			return createElement(AgeLabel, { modified: Number(modified), short: props.className.split(" ").includes("short") });
		}
		return createElement("span", props, children);
	},
};

export interface DocumentViewProps {
	readonly actions?: ReactNode;
	readonly after?: ReactNode;
	readonly answer?: ReactNode;
	readonly board?: readonly { readonly count: number; readonly title: string }[];
	readonly closing?: ReactNode;
	readonly components?: Components;
	readonly content?: ReactNode;
	readonly context?: ReactNode;
	readonly document: Document;
	readonly idPrefix?: string;
	readonly introduction?: ReactNode;
	readonly lead?: ReactNode;
}

export function DocumentView({
	document,
	idPrefix = "",
	context,
	content,
	introduction,
	board,
	after,
	answer,
	lead,
	actions,
	closing,
	components: overrides,
}: DocumentViewProps) {
	const layout = context !== undefined;
	const identity = document.identity ?? document.file;
	const states = useMemo(() => ({ identity, values: new Map<string, boolean>() }), [identity]);
	const rehypePlugins: PluggableList = [
		rehypeRaw,
		highlightDocument,
		footnoteIds(idPrefix),
		documentLinks(document.file, document.links),
		documentHeadings(true).plugin,
	];
	if (board) {
		rehypePlugins.push([boardLayout, board, document.modified, document.file, documentSourceId(document), layout]);
	}
	if (layout && !board) {
		rehypePlugins.push([documentLayout, documentSourceId(document)]);
	}
	return createElement(
		layout ? "div" : "article",
		{
			className: layout ? "document-layout grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,68ch)_minmax(240px,1fr)] lg:gap-x-8" : "doc reading-column",
		},
		createElement(
			DetailStatesContext.Provider,
			{ key: states.identity, value: states.values },
			createElement(
				LayoutContext.Provider,
				{
					value: {
						actions,
						after,
						answer,
						closing,
						content,
						context,
						file: document.file,
						identified: Boolean(document.metadata.id),
						introduction,
						lead,
					},
				},
				createElement(
					MarkdownHooks,
					{
						components: { ...components, ...overrides, ...(layout ? layoutElements : {}) },
						rehypePlugins,
						remarkPlugins: documentPlugins(new Map(Object.entries(document.questionActions))),
					},
					document.source,
				),
			),
		),
	);
}
