import type { Root } from "hast";
import { visit as visitElements } from "unist-util-visit";
import { textContent } from "#render/textContent.ts";

export interface Heading {
	readonly depth: number;
	readonly id: string;
	readonly title: string;
}

export function documentHeadings(titleFirst = false) {
	const entries: Heading[] = [];
	const used = new Set<string>();
	function plugin() {
		return function transform(tree: Root) {
			if (titleFirst) {
				const index = tree.children.findIndex((node) => node.type === "element" && node.tagName === "h1");
				if (index > 0) {
					tree.children.unshift(...tree.children.splice(index, 1));
				}
			}
			visitElements(tree, "element", (element) => {
				if (!["h1", "h2", "h3", "h4", "h5", "h6"].includes(element.tagName)) {
					return;
				}
				if (element.properties.id !== undefined) {
					return;
				}
				const title = element.children.map(textContent).join("").trim();
				const slug =
					title
						.normalize("NFKC")
						.toLowerCase()
						.replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
						.trim()
						.replace(/\s+/gu, "-") || "section";
				const base = `heading-${slug}`;
				let id = base;
				for (let suffix = 2; used.has(id); suffix += 1) {
					id = `${base}-${suffix}`;
				}
				used.add(id);
				entries.push({ depth: Number(element.tagName.slice(1)), id, title });
				element.children.push({
					children: [],
					properties: { ariaLabel: `Link to ${title || "section"}`, className: ["heading-anchor"], href: `#${id}` },
					tagName: "a",
					type: "element",
				});
				element.properties.id = id;
				element.properties.tabIndex = -1;
			});
		};
	}
	return { entries, plugin };
}
