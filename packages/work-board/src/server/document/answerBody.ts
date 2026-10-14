import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { documentBody } from "./body.ts";

export function answerBody(document: MetadataDocument, requests: readonly DocumentRequest[]): string {
	const source = documentBody(document);
	const cards = requests.filter((request) => request.open);
	const managed = document.parsed.fields.attention?.some((request) => request.managed);
	const title = managed ? requests[0]?.title : undefined;
	if (cards.length === 0 && !title) {
		return source;
	}
	const tree = unified().use(remarkParse).use(remarkDirective).parse(source);
	const removed = repeatedReason(tree.children, source, cards);
	return tree.children
		.flatMap((node, index) => {
			if (
				removed.has(index)
				|| promptInCard(node, cards)
				|| (managed && cards.some((request) => request.preview !== undefined) && inCardSection(tree.children, index, source))
			) {
				return [];
			}
			if (index === 0 && node.type === "heading" && node.depth === 1 && title) {
				return [`# ${title}`];
			}
			return [source.slice(node.position?.start.offset, node.position?.end.offset)];
		})
		.join("\n\n");
}

function repeatedReason(nodes: import("mdast").RootContent[], source: string, cards: readonly DocumentRequest[]) {
	const removed = new Set<number>();
	for (const [index, node] of nodes.entries()) {
		const text = node.type === "code" ? node.value : source.slice(node.position?.start.offset, node.position?.end.offset).trim();
		if (!cards.some((request) => request.preview && reasonMarkdown(request.preview.reason) === reasonMarkdown(text))) {
			continue;
		}
		removed.add(index);
		const previous = nodes[index - 1];
		const next = nodes[index + 1];
		if (previous?.type === "heading" && previous.depth > 1 && (!next || (next.type === "heading" && next.depth <= previous.depth))) {
			removed.add(index - 1);
		}
	}
	return removed;
}

function promptInCard(node: import("mdast").RootContent, cards: readonly DocumentRequest[]) {
	if (node.type !== "containerDirective" || node.name !== "question") {
		return false;
	}
	return cards.some(
		(request) =>
			!request.promptUnavailable
			&& (node.attributes?.request === undefined || node.attributes.request === request.id)
			&& request.prompts?.some((prompt) => prompt.id === node.attributes?.id),
	);
}

function inCardSection(nodes: import("mdast").RootContent[], index: number, source: string) {
	for (let position = index; position >= 0; position -= 1) {
		const node = nodes[position];
		if (node?.type === "containerDirective") {
			return false;
		}
		if (node?.type === "heading" && node.depth <= 2) {
			return ["## Recommendation", "## Relevant links"].includes(source.slice(node.position?.start.offset, node.position?.end.offset).trim());
		}
	}
	return false;
}
