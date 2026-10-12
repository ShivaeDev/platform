import { Effect } from "effect";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { readingTools } from "./readingTools.ts";
import { updated } from "./updated.ts";

export const documentHtml = Effect.fn("WorkBoard.documentHtml")(function* (
	source: string,
	file: MarkdownFile,
	metadata = "",
	introduction = "",
	questionActions?: ReadonlyMap<string, string>,
) {
	const headings = documentHeadings(true);
	const html = yield* renderMarkdown(source, { file: file.path, headings, ...(questionActions ? { questionActions } : {}) });
	const title = /^<h1\b[^>]*>[\s\S]*?<\/h1>/u.exec(html)?.[0] ?? "";
	return `<div class="document-layout"><header class="item-introduction">${title || `<h1>${escapeHtml(file.path)}</h1>`}${introduction}</header>
 <details class="item-context" data-key="item-context"><summary>Context and tools</summary><div class="context-content">
 <p class="meta">Source: ${escapeHtml(file.path)} · ${updated(file.modified)}</p>${metadata}${readingTools(headings.entries)}</div></details>
 <article class="doc">${html.slice(title.length)}</article></div>`;
});
