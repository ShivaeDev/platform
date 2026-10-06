import type { Element, Root } from "hast";
import { visit as visitElements } from "unist-util-visit";
import { fileUrl } from "#files/url.ts";
import { attachmentHref } from "#path/attachment.ts";

export function documentLinks(file: string) {
	function resolve(element: Element) {
		const attribute = element.tagName === "img" ? "src" : "href";
		const href = element.properties[attribute];
		if (typeof href !== "string" || href.startsWith("#") || href.startsWith("//") || /^[a-z][a-z\d+.-]*:/iu.exec(href) !== null) {
			return;
		}
		const target = new URL(href, `http://work-board.local${fileUrl(file)}`);
		const resolved = target.pathname + target.search + target.hash;
		const image = attachmentHref(resolved);
		element.properties[attribute] = image ?? resolved;
		if (element.tagName === "img" && image) {
			element.properties.dataLocalImage = image;
		}
	}
	return () => (tree: Root) => {
		visitElements(tree, "element", (element) => {
			if (element.tagName === "a" || element.tagName === "img") {
				resolve(element);
			}
		});
	};
}
