import { Effect } from "effect";
import { escapeHtml } from "#browser/escapeHtml.ts";
import type { QuestionPreview, RecordedResponse } from "#browser/responses/schema.ts";
import type { RenderFailed } from "#render/failed.ts";
import type { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";

export const historyHtml = Effect.fn("WorkBoard.historyHtml")(function* (
	q: QuestionPreview,
	records: readonly RecordedResponse[],
): Effect.fn.Return<string, RenderFailed, Highlighter> {
	const history = yield* Effect.forEach(records, (record) =>
		Effect.map(
			renderMarkdown(record.body, { file: `responses/${record.id}.md`, safe: true }),
			(html) =>
				`<article id="${escapeHtml(record.id)}"><h3><a href="/responses/${record.id}.md">${escapeHtml(record.response.author)} · ${record.response.type}</a></h3><p>${record.response.question === q.id ? "This reviewed revision" : "Earlier reviewed context — does not approve the current source"} · <code>${record.response.reviewedRevision}</code></p>${record.response.supersedes ? `<p>Explicitly supersedes <a href="/responses/${escapeHtml(record.response.supersedes)}.md">${escapeHtml(record.response.supersedes)}</a>.</p>` : ""}${html}</article>`,
		),
	);
	return `<section id="response-history"><h2>Recorded responses</h2>${history.join("") || "<p>No response is recorded for this source revision.</p>"}</section>`;
});
