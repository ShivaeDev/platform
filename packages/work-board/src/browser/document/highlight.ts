import type { Root } from "hast";
import { createHighlighter, type Highlighter } from "shiki";
import { codeBlocks } from "#render/code.ts";
import { THEMES } from "#render/highlighter.ts";

let highlighter: Promise<Highlighter> | undefined;

export function highlightDocument() {
	return async (tree: Root) => {
		highlighter ??= createHighlighter({ langs: [], themes: Object.values(THEMES) });
		await codeBlocks(await highlighter, { diagrams: false })()(tree);
	};
}
