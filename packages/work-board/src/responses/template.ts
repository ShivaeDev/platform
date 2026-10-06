import type { RootContent } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { metadataParse } from "#metadata/parse.ts";
import { templateLinks } from "./templateLinks.ts";
import { isContainer, promptFrom, sliceNode } from "./templateNodes.ts";

export interface Template {
	readonly context: string;
	readonly prompts: readonly Prompt[];
}
function nestedControl(node: RootContent): boolean {
	return (
		((node.type === "leafDirective" || node.type === "textDirective" || node.type === "containerDirective")
			&& ["question", "option"].includes(node.name))
		|| ("children" in node && node.children.some(nestedControl))
	);
}
function scopedPrompt(
	node: ContainerDirective,
	source: string,
	requests: readonly { readonly id: string; readonly state: string }[],
	request: string,
) {
	const result = promptFrom(node, source);
	if (result.request !== undefined && !requests.some((entry) => entry.id === result.request)) {
		throw new Error("A question's request= must name an attention request in this document.");
	}
	if (result.request === undefined && requests.filter((entry) => entry.state === "open").length > 1) {
		throw new Error("Use request= on question directives when a document has several open attention requests.");
	}
	return result.request === undefined || result.request === request ? result.prompt : undefined;
}
export function questionTemplate(context: string, request: string, file?: string): Template {
	const parsed = metadataParse(context);
	const parser = unified().use(remarkParse).use(remarkDirective);
	const body = parsed.body.replace(/\r\n?/gu, "\n");
	const original = parser.parse(body);
	const source = file === undefined ? body : templateLinks(body, original.children, file);
	const tree = parser.parse(source);
	const definitions = tree.children
		.filter((node) => node.type === "definition")
		.map((node) => sliceNode(source, node))
		.join("\n\n");
	const prompts: Prompt[] = [];
	const plain: string[] = [];

	for (const node of tree.children) {
		if (isContainer(node) && node.name === "question") {
			const prompt = scopedPrompt(node, source, parsed.fields.attention ?? [], request);
			if (prompt) {
				prompts.push({
					...prompt,
					options: prompt.options.map((option) => ({ ...option, source: `${option.source}\n\n${definitions}`.trim() })),
					source: `${prompt.source}\n\n${definitions}`.trim(),
				});
			}
		} else {
			if (nestedControl(node)) {
				throw new Error("Use top-level question containers with direct option children.");
			}
			plain.push(sliceNode(source, node));
		}
	}
	if (prompts.length > 32 || new Set(prompts.map((prompt) => prompt.id)).size !== prompts.length) {
		throw new Error("Use at most 32 questions with unique IDs per attention request.");
	}
	return { context: plain.join("\n\n"), prompts };
}
