import { Effect } from "effect";
import type { Handoff, HandoffPreview } from "#browser/handoffs/schema.ts";
import { fileUrl } from "#files/url.ts";
import { metadataParse } from "#metadata/parse.ts";
import { escapeHtml } from "#page/escape.ts";
import type { RenderFailed } from "#render/failed.ts";
import type { Highlighter } from "#render/highlighter.ts";
import { renderMarkdown } from "#render/markdown.ts";

export function promptHtml(id: string, prompt: string) {
	return `<div class="handoff-copy"><label>Prompt for your existing agent session<textarea id="handoff-prompt-${escapeHtml(id)}" readonly rows="3">${escapeHtml(prompt)}</textarea></label><button type="button" data-handoff-copy="handoff-prompt-${escapeHtml(id)}">Copy tiny prompt</button><p role="status" data-copy-status>Copy and paste this into your agent session. Preparing a file does not notify an agent.</p></div>`;
}
function receiptNote(h: Handoff["handoff"]) {
	if (!(h.by || h.note)) {
		return "";
	}
	return `<p>${escapeHtml(h.by ?? "Attribution not recorded")}${h.note ? ` · ${escapeHtml(h.note)}` : ""}</p>`;
}
export const handoffHistoryHtml = Effect.fn("WorkBoard.handoffHistoryHtml")(function* (
	records: readonly Handoff[],
	current?: HandoffPreview,
): Effect.fn.Return<string[], RenderFailed, Highlighter> {
	return yield* Effect.forEach(records, (record) =>
		Effect.gen(function* () {
			const h = record.handoff;
			const goal = yield* renderMarkdown(h.goal, { file: h.source, safe: true });
			const constraints = yield* renderMarkdown(h.constraints, { file: h.source, safe: true });
			const next = yield* renderMarkdown(h.nextAction, { file: h.source, safe: true });
			const same = current?.reviewedRevision === h.reviewedRevision && current.source === h.source;
			return `<article id="${escapeHtml(record.id)}"><h3><a href="${fileUrl(record.file)}">${escapeHtml(record.id)}</a> · ${escapeHtml(h.recipient)}</h3><p><b>Receipt: ${escapeHtml(h.state)}</b>${h.state === "requested" ? " — prepared; receipt not confirmed" : ""}. Execution and acceptance are not recorded by this state.</p><p>${same ? "Current reviewed source" : "Earlier or unavailable reviewed source; recheck before acting"} · <a href="${fileUrl(h.source)}">${escapeHtml(h.source)}</a> · <code>${h.reviewedRevision}</code></p>${receiptNote(h)}<h4>Goal</h4>${goal}<h4>Constraints</h4>${constraints || "<p>None recorded.</p>"}<h4>Next action</h4>${next}${promptHtml(record.id, record.prompt)}<details><summary>Exact reviewed source snapshot</summary><pre>${escapeHtml(record.context)}</pre></details></article>`;
		}),
	);
});
export const handoffFormHtml = Effect.fn("WorkBoard.handoffFormHtml")(function* (
	source: HandoffPreview,
	enabled: boolean,
): Effect.fn.Return<string, RenderFailed, Highlighter> {
	const parsed = metadataParse(source.context);
	const background = yield* renderMarkdown(parsed.body, { file: source.source, safe: true });
	const goal = /^#\s+(?<title>.+)$/mu.exec(parsed.body)?.groups?.title ?? source.item;
	return `<section class="response-context">${background}</section><details><summary>Exact source being reviewed</summary><pre>${escapeHtml(source.context)}</pre></details><form id="handoff-form" data-item="${escapeHtml(source.item)}" data-source="${escapeHtml(source.source)}" data-revision="${source.reviewedRevision}" data-question="${source.id}" data-writable="${enabled}"><label>Recipient — local agent label<input name="recipient" required maxlength="200"></label><label>Goal<textarea name="goal" required maxlength="8192" rows="3">${escapeHtml(goal)}</textarea></label><label>Constraints (optional)<textarea name="constraints" maxlength="8192" rows="4"></textarea></label><label>Next action<textarea name="nextAction" required maxlength="8192" rows="3">${escapeHtml(parsed.fields.nextAction ?? "")}</textarea></label><p>The file includes the full reviewed source and its declared acceptance criteria. Preparing it does not change the item or start an agent. Drafts use the existing 30-day/2-MiB workspace store.</p><button id="handoff-preview" type="button" disabled>Preview Markdown</button><pre id="handoff-preview-content" hidden></pre><button id="handoff-submit" type="submit" disabled>Prepare handoff</button><button id="handoff-clear" type="button" disabled>Clear workspace drafts</button><p id="handoff-status" role="status">${enabled ? "JavaScript is required to prepare a handoff." : "Read-only mode. Restart with --responses to enable local writes."}</p><section id="handoff-prepared" hidden></section></form>`;
});
