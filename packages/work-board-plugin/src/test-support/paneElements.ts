import { createElement, type ReactNode } from "react";
import type { paneView, Table } from "#pane.tsx";

type Element = ReturnType<typeof paneView>;
type Child = Element | string | number | boolean | null | undefined | readonly Child[];
const rendered = new WeakMap<Element, ReactNode>();

export function installPaneJsx(): void {
	Object.assign(globalThis, {
		h: (tag: (props: object) => Element, props: object, ...children: Child[]) => tag({ ...props, children }),
	});
}

function element(type: string, props: Record<string, unknown>, children?: Child): Element {
	const node = { props, type };
	const content = Array.isArray(children) ? children : [children];
	rendered.set(node, createElement(type, props, ...content.map(reactPane)));
	return node;
}

export const paneElements: Extract<Table, { Svg: unknown }> = {
	Box: ({ children, key, width, gap, columnGap, ...layout }) =>
		element(
			"div",
			{
				key,
				style: {
					display: "flex",
					...layout,
					columnGap: columnGap === undefined ? undefined : `${columnGap}ch`,
					gap: gap === undefined ? undefined : `${gap}ch`,
					width: typeof width === "number" ? `${width}ch` : width,
				},
			},
			children,
		),
	Button: ({ label, onPress, key }) => element("button", { key, onClick: onPress }, label),
	Link: ({ href, label, key }) => element("a", { href, key }, label),
	Svg: ({ alt, source, height }) =>
		element("div", { "aria-label": alt, "dangerouslySetInnerHTML": { __html: source }, role: "img", style: { height, width: "100%" } }),
	Text: ({ children, color, dimColor, key, size, weight, wrap }) =>
		element(
			"span",
			{
				key,
				style: {
					color,
					fontSize: size === "footnote" || size === "caption" ? "0.85em" : undefined,
					fontWeight: weight === "semibold" ? 600 : undefined,
					opacity: dimColor ? 0.7 : undefined,
					overflow: wrap === "truncate-end" ? "hidden" : undefined,
					textOverflow: wrap === "truncate-end" ? "ellipsis" : undefined,
					whiteSpace: wrap === "truncate-end" ? "nowrap" : undefined,
				},
			},
			children,
		),
};

export function reactPane(node: Child): ReactNode {
	if (typeof node !== "object" || node === null) {
		return node;
	}
	return "type" in node ? rendered.get(node) : node.map(reactPane);
}
