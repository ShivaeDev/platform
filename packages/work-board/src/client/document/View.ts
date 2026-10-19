import { createElement, Fragment, type ReactNode, useMemo } from "react";
import type { Components } from "react-markdown";
import type { Document } from "#browser/document/schema.ts";
import { DetailStatesContext, DocumentDetails } from "./Details.ts";
import { LayoutContext, layoutElements } from "./layoutElements.ts";
import { Mermaid } from "./Mermaid.ts";
import { type BoardCounts, useSections } from "./useSections.ts";

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
};

export interface DocumentViewProps {
	readonly actions?: ReactNode;
	readonly after?: ReactNode;
	readonly answer?: ReactNode;
	readonly board?: BoardCounts;
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
	const { complete, sections } = useSections({
		board,
		components: { ...components, ...overrides, ...(layout ? layoutElements : {}) },
		document,
		idPrefix,
		layout,
	});
	const [first, ...rest] = sections;
	const separate = layout && !board;
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
						body: separate ? rest : null,
						closing,
						complete,
						content,
						file: document.file,
						identified: Boolean(document.metadata.id),
						introduction,
						lead,
					},
				},
				separate ? first : sections,
			),
		),
		// The context follows the content in reading and Tab order, and waits for the first section so its readiness report sees the page's headings.
		first === undefined ? null : context,
	);
}
