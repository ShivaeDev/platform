import type { Element, Root } from "hast";
import { visit as visitElements } from "unist-util-visit";
import { fileUrl } from "#files/url.ts";
import { textContent } from "#render/textContent.ts";
import type { Entry } from "./entries.ts";

function sourceLine(element: Element, first: number | undefined, length: number): { readonly line?: number } {
	if (!element.position || first === undefined || element.position.start.line > length) {
		return {};
	}
	return { line: first + element.position.start.line - 1 };
}

export function searchCollector(file: string, startLine: () => number | undefined, length: () => number) {
	const entries: Entry[] = [];
	let passage = "";
	let label = file;
	function collect(element: Element) {
		const text = element.children.map(textContent).join("").replace(/\s+/gu, " ").trim();
		if (!text || element.properties.id === "footnote-label") {
			return;
		}
		const heading = element.tagName.startsWith("h") && element.tagName !== "th";
		if (heading && typeof element.properties.id === "string") {
			passage = element.properties.id;
			label = text;
		}
		entries.push({
			file,
			href: fileUrl(file) + (passage ? `#${encodeURIComponent(passage)}` : ""),
			kind: heading ? "heading" : "passage",
			...sourceLine(element, startLine(), length()),
			text,
			title: label,
		});
	}
	function plugin() {
		return function transform(tree: Root) {
			visitElements(tree, "element", (element) => {
				if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "pre", "li", "td", "th"].includes(element.tagName)) {
					collect(element);
				}
			});
		};
	}
	return { entries, plugin };
}
