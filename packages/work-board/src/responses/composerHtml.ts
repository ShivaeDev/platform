import { Effect } from "effect";
import type { QuestionPreview, RecordedResponse } from "#browser/responses/schema.ts";
import { fileUrl } from "#files/url.ts";
import { escapeHtml } from "#page/escape.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { templateHtml } from "./templateHtml.ts";

export const composerHtml = Effect.fn("WorkBoard.composerHtml")(function* (
	q: QuestionPreview,
	records: readonly RecordedResponse[],
	enabled: boolean,
) {
	const template = yield* templateHtml(q.context, q.request, q.source);
	const history = yield* Effect.forEach(records, (record) =>
		Effect.map(
			renderMarkdown(record.body, { file: `responses/${record.id}.md`, safe: true }),
			(html) =>
				`<article id="${escapeHtml(record.id)}"><h3><a href="/responses/${record.id}.md">${escapeHtml(record.response.author)} · ${record.response.type}</a></h3><p>${record.response.question === q.id ? "This reviewed revision" : "Earlier reviewed context — does not approve the current source"} · <code>${record.response.reviewedRevision}</code></p>${record.response.supersedes ? `<p>Explicitly supersedes <a href="/responses/${escapeHtml(record.response.supersedes)}.md">${escapeHtml(record.response.supersedes)}</a>.</p>` : ""}${html}</article>`,
		),
	);
	const prior = records
		.map(
			(record) =>
				`<option value="${escapeHtml(record.id)}">${escapeHtml(record.id)} · ${escapeHtml(record.response.author)} · ${record.response.reviewedRevision.slice(0, 12)}</option>`,
		)
		.join("");
	return `<section class="response-panel"><h1>Respond to ${escapeHtml(q.item)} / ${escapeHtml(q.request)}</h1><p>${escapeHtml(q.reason)}</p><p><a href="${fileUrl(q.source)}">Source: ${escapeHtml(q.source)}</a> · Reviewed SHA-256: <code>${q.reviewedRevision}</code></p><p>Saved replies are authored feedback. They do not close the request or establish acceptance.</p><section class="response-context">${template.background}</section><details><summary>Exact source being reviewed</summary><pre>${escapeHtml(q.context)}</pre></details><form id="response-form" data-question="${q.id}" data-writable="${enabled}" data-item="${escapeHtml(q.item)}" data-request="${escapeHtml(q.request)}" data-revision="${q.reviewedRevision}"><label>Local author label <input name="author" maxlength="200" required></label><label>Response kind <select name="type"><option value="answer">Answer (including no)</option><option value="clarify">Ask back / clarify</option><option value="not_now">Not now</option></select></label>${template.controls}<label>${template.hasPrompts ? "Overall response / next action (optional)" : "Your response"}<textarea name="body" rows="8" maxlength="32768" ${template.hasPrompts ? "" : "required"}></textarea></label><label>Supersedes an earlier response (optional)<select name="supersedes"><option value="">Adds feedback; does not supersede</option>${prior}</select></label><pre id="response-draft-recovery" hidden></pre><p>Submit the whole packet together. Drafts stay in this browser for 30 days after the last edit, with a 2 MiB workspace limit. Saved responses are Markdown files in responses/.</p><button id="response-preview" type="button" disabled>Preview Markdown</button><pre id="response-preview-content" hidden></pre><button id="response-submit" type="submit" disabled>Record response</button><button id="response-clear" type="button" disabled>Clear workspace drafts</button><p id="response-status" role="status">${enabled ? "JavaScript is required to record a response." : "Read-only mode. Restart with --responses to explicitly enable local writes."}</p></form><section id="response-history"><h2>Recorded responses</h2>${history.join("") || "<p>No response is recorded for this source revision.</p>"}</section></section>`;
});
