import type { Root } from "hast";
import { visit as visitElements } from "unist-util-visit";

export function linkCollector(links: Set<string>) {
	return () => (tree: Root) => {
		visitElements(tree, "element", (element) => {
			if (element.tagName !== "a") {
				return;
			}
			const href = element.properties.href;
			if (typeof href === "string" && !href.startsWith("#")) {
				links.add(href);
			}
		});
	};
}
