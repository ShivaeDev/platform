import type { Root } from "mdast";
import { visit as visitNodes } from "unist-util-visit";

const alerts = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

export function callouts() {
	return function transform(tree: Root) {
		visitNodes(tree, "blockquote", (node) => {
			const [first] = node.children;
			const text = first?.type === "paragraph" ? first.children.at(0) : undefined;
			if (text?.type !== "text") {
				return;
			}
			const match = /^\[!(?<kind>[A-Z]+)\](?:\n|$)/u.exec(text.value);
			const named = match?.groups?.kind;
			if (!(named && alerts.has(named))) {
				return;
			}
			const kind = named.toLowerCase();
			text.value = text.value.slice(match?.[0].length ?? 0);
			node.children.unshift({
				children: [{ type: "text", value: named[0] + kind.slice(1) }],
				data: { hProperties: { className: ["visual-label"] } },
				type: "paragraph",
			});
			node.data = { ...node.data, hName: "aside", hProperties: { className: ["visual-callout", `visual-${kind}`], role: "note" } };
		});
	};
}
