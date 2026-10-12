import type { Root } from "hast";
import type { Document } from "#browser/document/schema.ts";

export function documentSourceId(document: Document): string {
	const source = JSON.stringify([document.file, document.source, document.links, document.questionActions]);
	let hash = 0;
	for (const character of source) {
		hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
	}
	return `${source.length}:${hash}`;
}
export function documentLayout(source: string) {
	return (tree: Root) => {
		const first = tree.children.at(0);
		const title = first?.type === "element" && first.tagName === "h1" ? first : undefined;
		if (title) {
			tree.children.shift();
		}
		tree.children = [
			{ children: title ? [title] : [], properties: { className: ["item-introduction"] }, tagName: "header", type: "element" },
			{
				children: tree.children.filter((node) => node.type !== "doctype"),
				properties: { className: ["doc"], dataSource: source },
				tagName: "article",
				type: "element",
			},
		];
	};
}
