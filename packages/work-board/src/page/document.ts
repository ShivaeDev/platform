import { Effect } from "effect";
import type { MarkdownFile } from "../files/list.ts";
import { renderMarkdown } from "../render/markdown.ts";
import { escapeHtml } from "./escape.ts";
import { updated } from "./updated.ts";

export const documentHtml = Effect.fn("WorkBoard.documentHtml")(function* (source: string, file: MarkdownFile) {
	const html = yield* renderMarkdown(source);
	return `<p class="meta">${escapeHtml(file.path)} · ${updated(file.modified)}</p><article class="doc">${html}</article>`;
});
