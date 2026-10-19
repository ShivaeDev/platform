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
	let titled = false;
	function enter(heading: Element, text: string, title: boolean) {
		if (typeof heading.properties.id === "string") {
			passage = title ? "" : heading.properties.id;
			label = text;
		}
	}
	function collect(element: Element) {
		const text = element.children.map(textContent).join("").replace(/\s+/gu, " ").trim();
		const title = element.tagName === "h1" && !titled;
		titled ||= element.tagName === "h1";
		if (!text || element.properties.id === "footnote-label") {
			return;
		}
		const heading = /^h[1-6]$/u.test(element.tagName);
		if (heading) {
			enter(element, text, title);
		}
		// The document entry already stands for its title, so the title and its passages share the document's address.
		if (title) {
			return;
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
