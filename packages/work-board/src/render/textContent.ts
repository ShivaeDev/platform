import type { ElementContent } from "hast";

export function textContent(node: ElementContent): string {
	if (node.type === "text") {
		return node.value;
	}
	return node.type === "element" ? node.children.map(textContent).join("") : "";
}
