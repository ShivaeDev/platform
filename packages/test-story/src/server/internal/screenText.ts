import { isRendered } from "./screenAccessibility.ts";

const blockDisplays = new Set(["block", "flow-root", "flex", "grid", "list-item", "table", "table-row", "table-caption"]);

export function screenText(root: HTMLElement): string {
	let text = "";
	let boundary = false;
	function append(node: Node) {
		if (!(node.parentElement instanceof HTMLElement && isRendered(node.parentElement))) {
			return;
		}
		const content = node.textContent ?? "";
		if (content.length === 0) {
			return;
		}
		if (boundary && text.length > 0 && !/\s$/u.test(text) && !/^\s/u.test(content)) {
			text += "\n";
		}
		text += content;
		boundary = false;
	}
	function visit(node: Node) {
		if (node.nodeType === Node.TEXT_NODE) {
			append(node);
			return;
		}
		const rendered = node instanceof HTMLElement && isRendered(node);
		const block = rendered && blockDisplays.has(getComputedStyle(node).display);
		if (block || (rendered && node.tagName === "BR")) {
			boundary = true;
		}
		for (const child of node.childNodes) {
			visit(child);
		}
		if (block) {
			boundary = true;
		}
	}
	visit(root);
	return text;
}
