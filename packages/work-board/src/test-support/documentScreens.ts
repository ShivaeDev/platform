import { Effect } from "effect";
import { documentHeadings } from "#render/documentHeadings.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { mermaidEngine } from "./mermaidEngine.ts";
import { screenStory } from "./screenStory.ts";

export function serverMarkup(source: string, questionActions: Readonly<Record<string, string>>) {
	return screenStory.trait("workspace", "the server renders the same source for comparison", function* (engine) {
		const html = yield* renderMarkdown(metadataParse(source).body, {
			file: "nested/reading.md",
			headings: documentHeadings(true),
			questionActions: new Map(Object.entries(questionActions)),
		}).pipe(Effect.provide(Highlighter.layer));
		engine.referenceMarkup = document.createElement("div");
		engine.referenceMarkup.innerHTML = html;
	});
}

export function failingDiagrams() {
	return screenStory.trait("workspace", "the diagram renderer rejects the next diagram", () => {
		mermaidEngine.render.mockRejectedValueOnce(new Error("Invalid diagram"));
	});
}
