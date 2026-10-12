import type { Element, ElementContent, Root } from "hast";

function element(tagName: string, children: ElementContent[] = [], className?: string): Element {
	return { children, properties: className ? { className: [className] } : {}, tagName, type: "element" };
}
interface Draft {
	readonly board: Element;
	closing: boolean;
	readonly footer: Element;
	readonly header: Element;
	item: Element | undefined;
	section: Element | undefined;
}
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
		draft.section = element("section", [node]);
		draft.board.children.push(draft.section);
		draft.item = undefined;
		return;
	}
	if (!draft.section) {
		draft.header.children.push(node);
		return;
	}
	if (node.type === "element" && node.tagName === "h3") {
		draft.item = element("article", [node], "item");
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
export function boardLayout(counts: readonly { readonly count: number; readonly title: string }[], modified: number, file: string, source: string) {
	return (tree: Root) => {
		const nodes = tree.children.filter((node): node is ElementContent => node.type !== "doctype" && !(node.type === "text" && !node.value.trim()));
		const lastHeading = nodes.findLastIndex((node) => node.type === "element" && /^h[1-6]$/u.test(node.tagName));
		const draft: Draft = {
			board: element("div", [], "board"),
			closing: false,
			footer: element("footer"),
			header: element("header", [], "board-head"),
			item: undefined,
			section: undefined,
		};
		for (const [index, node] of nodes.entries()) {
			place(draft, node, index > lastHeading);
		}
		if (!draft.header.children.some((node) => node.type === "element" && node.tagName === "h1")) {
			draft.header.children.unshift(element("h1", [{ type: "text", value: file }]));
		}
		const age = element("span", [{ type: "text", value: `updated ${new Date(modified).toISOString()}` }], "age");
		age.properties.dataModified = modified;
		draft.board.properties.dataSource = source;
		draft.header.children.push(summary(counts), element("p", [age], "meta"));
		tree.children = [draft.header, draft.board, ...(draft.footer.children.length > 0 ? [draft.footer] : [])];
	};
}
