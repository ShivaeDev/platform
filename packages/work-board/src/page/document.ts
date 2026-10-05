import { Effect } from "effect";
import type { MarkdownFile } from "#files/list.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { escapeHtml } from "./escape.ts";
import { readingTools } from "./readingTools.ts";
import { updated } from "./updated.ts";

export const documentHtml = Effect.fn("WorkBoard.documentHtml")(function* (source: string, file: MarkdownFile, metadata = "") {
	const headings = documentHeadings();
	const html = yield* renderMarkdown(source, { file: file.path, headings });
	return `${readingTools(headings.entries)}<p class="meta">${escapeHtml(file.path)} · ${updated(file.modified)}</p>${metadata}<article class="doc">${html}</article>`;
});
