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
	return `<div class="document-layout grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,68ch)_minmax(240px,1fr)] lg:gap-x-8"><header class="item-introduction">${title || `<h1>${escapeHtml(file.path)}</h1>`}${introduction}</header>
 <aside class="item-context min-w-0 self-start rounded-lg border border-border p-4 text-sm lg:col-start-2 lg:row-start-2" data-key="item-context">
 <p class="meta">Source: ${escapeHtml(file.path)} · ${updated(file.modified)}</p>${metadata}${readingTools(headings.entries)}</aside>
 <article class="doc reading-column lg:col-start-1 lg:row-start-2">${html.slice(title.length)}</article></div>`;
});
