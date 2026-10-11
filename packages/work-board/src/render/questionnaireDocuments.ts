import type { Paragraph, Root } from "mdast";
import { visit } from "unist-util-visit";

function answerAction(href: string): Paragraph {
	return {
		children: [
			{
				children: [{ type: "text", value: "Answer these questions" }],
				data: { hProperties: { className: ["questionnaire-answer"] } },
				type: "link",
				url: href,
			},
		],
		type: "paragraph",
	};
}

export function questionnaireDocuments(actions?: ReadonlyMap<string, string>) {
	return (tree: Root) => {
		visit(tree, "containerDirective", (node) => {
			if (node.name === "question" || node.name === "option") {
				node.data = { hName: "section", hProperties: { className: ["questionnaire-reading", `questionnaire-${node.name}`] } };
				const href = node.name === "question" ? actions?.get(`${node.attributes?.request ?? ""}/${node.attributes?.id ?? ""}`) : undefined;
				if (href) {
					node.children.unshift(answerAction(href));
				}
			}
		});
	};
}
