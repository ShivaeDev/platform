import type { Root } from "hast";
import type { Document } from "#browser/document/schema.ts";

// Hashing a long document costs more than a frame on a slow phone, and readiness checks ask on every DOM change.
const sourceIds = new WeakMap<Document, string>();

export function documentSourceId(document: Document): string {
	const known = sourceIds.get(document);
	if (known !== undefined) {
		return known;
	}
	const source = JSON.stringify([document.file, document.source, document.links, document.questionActions]);
	let hash = 0;
	for (const character of source) {
		hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
	}
	const id = `${source.length}:${hash}`;
	sourceIds.set(document, id);
	return id;
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
				properties: { className: ["doc", "reading-column", "lg:col-start-1", "row-start-2"], dataSource: source },
				tagName: "article",
				type: "element",
			},
		];
	};
}
