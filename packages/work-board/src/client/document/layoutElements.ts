import { Children, type ComponentProps, createContext, createElement, Fragment, isValidElement, type ReactNode, useContext } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { PageHeader } from "#client/react/PageHeader.tsx";
import { useCompactHeader } from "./useCompactHeader.ts";

export const LayoutContext = createContext<{
	readonly actions: ReactNode;
	readonly after: ReactNode;
	readonly answer: ReactNode;
	readonly body: ReactNode;
	readonly closing: ReactNode;
	readonly complete: boolean;
	readonly content: ReactNode;
	readonly introduction: ReactNode;
	readonly lead: ReactNode;
	readonly file: string;
	readonly identified: boolean;
}>({
	actions: null,
	after: null,
	answer: null,
	body: null,
	closing: null,
	complete: true,
	content: null,
	file: "",
	identified: false,
	introduction: null,
	lead: null,
});
export const layoutElements: Components = { article: LayoutArticle, header: LayoutHeader };
function LayoutArticle({ node, children, ...props }: ComponentProps<"article"> & ExtraProps) {
	const { after, body, closing, complete, content } = useContext(LayoutContext);
	if (node?.properties.dataSource === undefined) {
		return createElement("article", props, children);
	}
	// The page counts as shown, and a deep link scrolls, only once the last section is in place.
	const article = { ...props, "data-source": complete ? String(node.properties.dataSource) : undefined };
	return createElement(Fragment, null, createElement("article", article, content, children, body, closing), after);
}
function LayoutHeader({ node: _node, children, ...props }: ComponentProps<"header"> & ExtraProps) {
	const { actions, answer, introduction, lead, file, identified } = useContext(LayoutContext);
	const introducing = props.className?.split(" ").includes("item-introduction") ?? false;
	const { compact, height, ref } = useCompactHeader(introducing && identified);
	if (!introducing) {
		return createElement("header", props, children);
	}
	const [first, ...rest] = Children.toArray(children);
	const heading = isValidElement<ComponentProps<"h1">>(first) && first.type === "h1" ? first : undefined;
	const { children: title, ...titleProps } = heading?.props ?? { children: file, className: "font-mono" };
	const leading = heading ? rest : Children.toArray(children);
	return createElement(
		Fragment,
		null,
		// Reserve the expanded grid row in the same commit; measuring after compaction lets scroll anchoring move the reader first.
		compact
			? createElement("div", { "aria-hidden": true, className: "pointer-events-none col-span-full row-start-1 -mt-3", style: { height } })
			: null,
		createElement(PageHeader, {
			...props,
			actions,
			className: `${props.className} col-span-full row-start-1 self-start bg-background pb-4 ${identified ? "sticky top-[var(--board-header-height,0px)] z-10 -mt-3 border-border border-b pt-3" : ""}`,
			compact,
			ref,
			summary: leading.length > 0 || introduction ? createElement(Fragment, null, ...leading, introduction) : undefined,
			title,
			titleProps,
		}),
		lead,
		answer,
	);
}
