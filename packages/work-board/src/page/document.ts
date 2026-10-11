import { Effect } from "effect";
import type { MarkdownFile } from "#files/list.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { escapeHtml } from "./escape.ts";
import { readingTools } from "./readingTools.ts";
import { updated } from "./updated.ts";

export const documentHtml = Effect.fn("WorkBoard.documentHtml")(function* (source: string, file: MarkdownFile, metadata = "", introduction = "") {
	const headings = documentHeadings(true);
	const html = yield* renderMarkdown(source, { file: file.path, headings });
	const title = /^<h1\b[^>]*>[\s\S]*?<\/h1>/u.exec(html)?.[0] ?? "";
	return `<div class="document-layout"><header class="item-introduction">${title || `<h1>${escapeHtml(file.path)}</h1>`}${introduction}</header>
 <details class="item-context" data-key="item-context"><summary>Context and tools</summary><div class="context-content">
 <p class="meta">Source: ${escapeHtml(file.path)} · ${updated(file.modified)}</p>${metadata}${readingTools(headings.entries)}</div></details>
 <article class="doc">${html.slice(title.length)}</article></div>`;
});
