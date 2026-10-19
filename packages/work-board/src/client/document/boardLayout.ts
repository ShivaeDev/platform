import type { Element, ElementContent, Root } from "hast";

function element(tagName: string, children: ElementContent[] = [], className?: string): Element {
	return { children, properties: className ? { className: [className] } : {}, tagName, type: "element" };
}
interface Draft {
	readonly board: Element;
	closing: boolean;
	readonly footer: Element;
	readonly header: Element;
	readonly introduction: Element;
	item: Element | undefined;
	section: Element | undefined;
}
const ITEM = "item my-3 rounded-lg border bg-card px-4 py-3 [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&>h3]:mb-2 [&>h3]:text-base";
function place(draft: Draft, node: ElementContent, afterHeading: boolean) {
	if (node.type === "element" && node.tagName === "hr" && afterHeading && draft.section) {
		draft.closing = true;
		return;
	}
	if (draft.closing) {
		draft.footer.children.push(node);
		return;
	}
	if (node.type === "element" && node.tagName === "h2") {
		draft.section = element("section", [node], "board-section");
		draft.board.children.push(draft.section);
		draft.item = undefined;
		return;
	}
	if (!draft.section) {
		(node.type === "element" && node.tagName === "h1" ? draft.header : draft.introduction).children.push(node);
		return;
	}
	if (node.type === "element" && node.tagName === "h3") {
		draft.item = element("article", [node], ITEM);
		draft.section.children.push(draft.item);
		return;
	}
	if (!draft.item) {
		draft.item = element("div", [], "notes");
		draft.section.children.push(draft.item);
	}
	draft.item.children.push(node);
}
function summary(counts: readonly { readonly count: number; readonly title: string }[]) {
	const result = element("p", [], "counts");
	for (const [index, count] of counts.entries()) {
		if (index > 0) {
			result.children.push({ type: "text", value: " · " });
		}
		result.children.push(
			element("span", [element("b", [{ type: "text", value: String(count.count) }]), { type: "text", value: ` ${count.title.toLowerCase()}` }]),
		);
	}
	return result;
}
export function boardLayout(
	counts: readonly { readonly count: number; readonly title: string }[],
	modified: number,
	file: string,
	source: string,
	layout = false,
) {
	return (tree: Root) => {
		const nodes = tree.children.filter((node): node is ElementContent => node.type !== "doctype" && !(node.type === "text" && !node.value.trim()));
		const lastHeading = nodes.findLastIndex((node) => node.type === "element" && /^h[1-6]$/u.test(node.tagName));
		const draft: Draft = {
			board: element("div", [], layout ? "board doc reading-column lg:col-start-1 lg:row-start-2" : "board"),
			closing: false,
			footer: element("footer"),
			header: element("header", [], layout ? "item-introduction board-head" : "board-head"),
			introduction: element("div", [], "board-introduction"),
			item: undefined,
			section: undefined,
		};
		for (const [index, node] of nodes.entries()) {
			place(draft, node, index > lastHeading);
		}
		if (!draft.header.children.some((node) => node.type === "element" && node.tagName === "h1")) {
			draft.header.children.unshift(element("h1", [{ type: "text", value: file }]));
		}
		draft.board.properties.dataSource = source;
		const footer = draft.footer.children.length > 0 ? [draft.footer] : [];
		if (draft.introduction.children.length > 0) {
			draft.board.children.unshift(draft.introduction);
		}
		if (layout) {
			draft.board.children.push(...footer);
			tree.children = [draft.header, draft.board];
			return;
		}
		const age = element("span", [{ type: "text", value: `updated ${new Date(modified).toISOString()}` }], "age");
		age.properties.dataModified = modified;
		draft.header.children.push(summary(counts), element("p", [age], "meta"));
		tree.children = [draft.header, draft.board, ...footer];
	};
}
