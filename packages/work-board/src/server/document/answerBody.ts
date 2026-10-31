import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import type { MetadataDocument } from "#integration/metadata.ts";
import { documentBody } from "./body.ts";
import { REVIEWED_WORK_HEADING, reviewedWork } from "./reviewedWork.ts";

export function answerBody(document: MetadataDocument, requests: readonly DocumentRequest[], fleetTitle?: string): string {
	const source = documentBody(document);
	const cards = requests.filter((request) => request.open && request.preview?.source === document.file);
	const managed = document.parsed.fields.attention?.some((request) => request.managed);
	const title = managed ? (fleetTitle ?? requests[0]?.title) : undefined;
	if (cards.length === 0 && !title && !managed) {
		return source;
	}
	const tree = unified().use(remarkParse).use(remarkDirective).parse(source);
	const removed = repeatedReason(tree.children, source, cards);
	return tree.children
		.flatMap((node, index): [Node, string][] => {
			if (
				removed.has(index)
				|| promptInCard(node, cards)
				|| (managed && cards.some((request) => request.preview !== undefined) && inCardSection(tree.children, index, source))
			) {
				return [];
			}
			if (index === 0 && node.type === "heading" && node.depth === 1 && title) {
				return [[node, `# ${title}`]];
			}
			const reviewed = managed && node.type === "code" && underReviewedWork(tree.children[index - 1], source) ? reviewedWork(node.value) : undefined;
			if (reviewed !== undefined) {
				return [[node, reviewed]];
			}
			return [[node, source.slice(node.position?.start.offset, node.position?.end.offset)]];
		})
		.filter(([node], index, kept) => !(managed && emptySection(node, kept[index + 1]?.[0])))
		.map(([, text]) => text)
		.join("\n\n");
}

type Node = import("mdast").RootContent;

// A generated packet writes every section heading even when it has nothing to say.
function emptySection(node: Node, next: Node | undefined) {
	if (node.type !== "heading" || node.depth !== 2) {
		return false;
	}
	return next === undefined || (next.type === "heading" && next.depth <= 2) || (next.type === "containerDirective" && next.name === "question");
}

function repeatedReason(nodes: import("mdast").RootContent[], source: string, cards: readonly DocumentRequest[]) {
	const reasons = cards.flatMap((request) => (request.preview ? [reasonMarkdown(request.preview.reason)] : []));
	const removed = new Set<number>();
	for (const [index] of nodes.entries()) {
		const end = repeatedPassageEnd(nodes, source, index, reasons);
		if (end === undefined) {
			continue;
		}
		for (let position = index; position <= end; position += 1) {
			removed.add(position);
		}
		const previous = nodes[index - 1];
		const next = nodes[end + 1];
		if (previous?.type === "heading" && previous.depth > 1 && (!next || (next.type === "heading" && next.depth <= previous.depth))) {
			removed.add(index - 1);
		}
	}
	return removed;
}

function repeatedPassageEnd(nodes: import("mdast").RootContent[], source: string, start: number, reasons: readonly string[]) {
	let matched: number | undefined;
	const first = nodes[start];
	for (let end = start; end < nodes.length; end += 1) {
		const text =
			end === start && first?.type === "code" ? first.value : source.slice(first?.position?.start.offset, nodes[end]?.position?.end.offset);
		const passage = reasonMarkdown(text);
		if (!reasons.some((reason) => reason.startsWith(passage))) {
			break;
		}
		if (reasons.includes(passage)) {
			matched = end;
		}
	}
	return matched;
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

function underReviewedWork(node: import("mdast").RootContent | undefined, source: string) {
	return node?.type === "heading" && source.slice(node.position?.start.offset, node.position?.end.offset).trim() === REVIEWED_WORK_HEADING;
}
