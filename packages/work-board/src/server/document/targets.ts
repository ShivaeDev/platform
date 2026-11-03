import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { parseMarkdown } from "#adapters/markdownProcessor.ts";
import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import { resolveDocumentLink } from "#render/documentLinks.ts";
import { referenceTarget } from "#server/metadata/links.ts";
import { referencesOf } from "#server/metadata/referencesOf.ts";

export function documentTargets(document: MetadataDocument, model: MetadataModel, additional: readonly string[] = []) {
	const urls = new Set(document.links);
	const tree: Root = parseMarkdown(document.parsed.body, { directives: true, gfm: true });
	visit(tree, (node) => {
		if (node.type === "link" || node.type === "image" || node.type === "definition") {
			urls.add(node.url);
		}
	});
	return {
		links: Object.fromEntries([...urls].map((url) => [url, resolveDocumentLink(url, document.file)])),
		references: Object.fromEntries(
			[...referencesOf(document).map(({ target }) => target), ...additional].flatMap((target) => {
				const href = referenceTarget(target, model);
				return href ? [[target, href]] : [];
			}),
		),
	};
}
