import { Effect } from "effect";
import { escapeHtml } from "#browser/escapeHtml.ts";
import type { QuestionPreview, RecordedResponse } from "#browser/responses/schema.ts";
import { fileUrl } from "#files/url.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { historyHtml } from "./historyHtml.ts";
import { templateHtml } from "./templateHtml.ts";

export const composerHtml = Effect.fn("WorkBoard.composerHtml")(function* (
	q: QuestionPreview,
	records: readonly RecordedResponse[],
	enabled: boolean,
) {
	const template = yield* templateHtml(q.context, q.request, q.source);
	const standalone = metadataParse(q.context).fields.kind === "question";
	const prior = records
		.map(
			(record) =>
				`<option value="${escapeHtml(record.id)}">${escapeHtml(record.id)} · ${escapeHtml(record.response.author)} · ${record.response.reviewedRevision.slice(0, 12)}</option>`,
		)
		.join("");
	const body = `<label>${template.hasPrompts ? "Overall response / next action (optional)" : "Your response"}<textarea name="body" rows="4" maxlength="32768" ${template.hasPrompts ? "" : "required"}></textarea></label>`;
	const details = `<details data-key="response-details"><summary>Response details</summary><label>Response kind <select name="type"><option value="answer">Answer (including no)</option><option value="clarify">Ask back / clarify</option><option value="not_now">Not now</option></select></label>${standalone && template.hasPrompts ? body : ""}<label>Supersedes an earlier response (optional)<select name="supersedes"><option value="">Adds feedback; does not supersede</option>${prior}</select></label></details>`;
	return `<section class="response-panel"><h${standalone ? "2" : "1"}>${standalone ? "Answer this question" : `Respond to ${escapeHtml(q.item)} / ${escapeHtml(q.request)}`}</h${standalone ? "2" : "1"}><p>${escapeHtml(q.reason)}</p><p><a href="${fileUrl(q.source)}">Source: ${escapeHtml(q.source)}</a> · Reviewed SHA-256: <code>${q.reviewedRevision}</code></p><p>${standalone ? "An answer removes this question from the Inbox for this source revision." : "Saved replies are authored feedback. They do not close the request or establish acceptance."}</p>${standalone ? "" : `<section class="response-context">${template.background}</section>`}<details><summary>Exact source being reviewed</summary><pre>${escapeHtml(q.context)}</pre></details><form novalidate id="response-form" data-question="${q.id}" data-writable="${enabled}" data-item="${escapeHtml(q.item)}" data-request="${escapeHtml(q.request)}" data-revision="${q.reviewedRevision}"><label>Local author label <input name="author" maxlength="200" required autocomplete="nickname"></label>${template.controls}${standalone && template.hasPrompts ? "" : body}${details}<pre id="response-draft-recovery" hidden></pre><p>Submit the whole packet together. Drafts stay in this browser for 30 days after the last edit, with a 2 MiB workspace limit. Saved responses are Markdown files in responses/.</p><button id="response-preview" type="button" disabled>Preview Markdown</button><pre id="response-preview-content" hidden></pre><button id="response-submit" type="submit" disabled>Record response</button><button id="response-clear" type="button" disabled>Clear workspace drafts</button><p id="response-status" role="status">${enabled ? "JavaScript is required to record a response." : "Read-only mode. Restart with --responses to explicitly enable local writes."}</p></form>${yield* historyHtml(q, records)}</section>`;
});
