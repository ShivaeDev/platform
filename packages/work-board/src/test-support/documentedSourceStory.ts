import { Effect } from "effect";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { parseDocument } from "yaml";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { documentPlugins } from "#render/documentPlugins.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { questionTemplate } from "#server/responses/template.ts";
import { type DocumentedExample, documentedExample } from "./documentedExamples.ts";

function exampleSource(example: DocumentedExample) {
	if (example.language !== "yaml") {
		return example.source;
	}
	if (example.document === "docs/delivery/handoff-examples.md") {
		const original = metadataParse(documentedExample(example.document, 1).source);
		const header = parseDocument(original.raw?.slice(4, -4) ?? "");
		for (const [key, value] of Object.entries(parseDocument(example.source).toJS())) {
			header.setIn(["handoff", key], value);
		}
		return `---\n${header.toString()}---\n${original.body}`;
	}
	return `---\n${example.source}---\n`;
}

export const documentedSourceStory = storyKit({
	create: () => Effect.succeed({ source: "" }),
	inspect: (engine) => ({ source: engine.source }),
	name: "documented source",
	stages: ["source"],
	verbs: (engine, story) => ({
		metadata: () => {
			story.tell("the Board parses the example's source fields");
			return Effect.sync(() => metadataParse(engine.source));
		},
		packet: (request: string) => {
			story.tell(`the Board reads the example's ${request} question packet`);
			return Effect.sync(() => questionTemplate(engine.source, request));
		},
		rendered: () => {
			story.tell("the Board renders the example's Markdown components");
			return Effect.sync(() => {
				const source = metadataParse(engine.source).body;
				const processor = unified().use(remarkParse);
				processor.use(documentPlugins());
				const tree = processor.parse(source);
				processor.runSync(tree, { value: source });
				const diagnostics: string[] = [];
				const visuals: string[] = [];
				visit(tree, "paragraph", (node) => {
					for (const child of node.children) {
						if (child.type === "text" && child.value.startsWith("Visual component could not be rendered:")) {
							diagnostics.push(child.value);
						}
					}
				});
				visit(tree, "containerDirective", (node) => {
					if (["metric", "progress", "timeline"].includes(node.name)) {
						visuals.push(node.name);
					}
				});
				return { diagnostics, visuals };
			});
		},
	}),
});

export function sourceExample(document: string, number: number) {
	return documentedSourceStory.trait("source", `the reader uses example ${number} from ${document}`, (engine) => {
		engine.source = exampleSource(documentedExample(document, number));
	});
}
