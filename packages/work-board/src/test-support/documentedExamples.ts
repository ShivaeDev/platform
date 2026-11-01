import { readdirSync, readFileSync } from "node:fs";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export interface DocumentedExample {
	readonly document: string;
	readonly language: string;
	readonly number: number;
	readonly source: string;
}

const root = new URL("../../", import.meta.url);
const documents = [
	"README.md",
	...readdirSync(new URL("docs/delivery/", root))
		.filter((file) => file.endsWith(".md"))
		.map((file) => `docs/delivery/${file}`),
];

export function documentation(document: string) {
	return readFileSync(new URL(document, root), "utf8");
}

export const documentedExamples = documents.flatMap((document) => {
	const tree = unified().use(remarkParse).parse(documentation(document));
	const examples: DocumentedExample[] = [];
	visit(tree, "code", (node) => {
		if (node.lang === "markdown" || node.lang === "yaml" || node.lang === "text") {
			examples.push({ document, language: node.lang, number: examples.length + 1, source: `${node.value}\n` });
		}
	});
	return examples;
});

export function documentedExample(document: string, number: number) {
	const example = documentedExamples.find((entry) => entry.document === document && entry.number === number);
	if (!example) {
		throw new Error(`No source example ${number} in ${document}`);
	}
	return example;
}
