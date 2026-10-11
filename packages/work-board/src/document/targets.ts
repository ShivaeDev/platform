import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { referenceTarget } from "#metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#metadata/model.ts";
import { referencesOf } from "#metadata/referencesOf.ts";
import { resolveDocumentLink } from "#render/documentLinks.ts";

export function documentTargets(document: MetadataDocument, model: MetadataModel) {
	const urls = new Set(document.links);
	const tree: Root = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(document.parsed.body);
	visit(tree, (node) => {
		if (node.type === "link" || node.type === "image" || node.type === "definition") {
			urls.add(node.url);
		}
	});
	return {
		links: Object.fromEntries([...urls].map((url) => [url, resolveDocumentLink(url, document.file)])),
		references: Object.fromEntries(
			referencesOf(document).flatMap(({ target }) => {
				const href = referenceTarget(target, model);
				return href ? [[target, href]] : [];
			}),
		),
	};
}
