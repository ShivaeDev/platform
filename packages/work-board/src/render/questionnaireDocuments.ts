import type { Root } from "mdast";
import { visit } from "unist-util-visit";

export function questionnaireDocuments() {
	return (tree: Root) => {
		visit(tree, "containerDirective", (node) => {
			if (node.name === "question" || node.name === "option") {
				node.data = { hName: "section", hProperties: { className: ["questionnaire-reading", `questionnaire-${node.name}`] } };
			}
		});
	};
}
