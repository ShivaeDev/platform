import { fileUrl } from "#files/url.ts";
import { escapeHtml } from "#page/escape.ts";
import { compareHistory, type SourceChange } from "./compare.ts";
import type { Baseline } from "./schema.ts";

function source(label: string, text: string, key: string): string {
	return `<details data-key="${escapeHtml(key)}:${label}" data-history-source="${label.toLowerCase()}"><summary>${label} source (plain text)</summary><pre class="history-source">${escapeHtml(text)}</pre></details>`;
}
function changeHtml(change: SourceChange): string {
	const file = change.after?.file ?? change.before?.file ?? "";
	const key = change.before ? `before:${change.before.file}` : `added:${file}`;
	return `<article class="history-change" data-key="${escapeHtml(key)}"><h2>${change.kind}: ${escapeHtml(file)}</h2>${change.before && change.after && change.before.file !== file ? `<p>Previously ${escapeHtml(change.before.file)}</p>` : ""}<ul>${change.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>${change.after ? `<a href="${escapeHtml(fileUrl(change.after.file))}">Read current source</a>` : "<p>Removed source; no current document link.</p>"}${change.before ? source("Remembered", change.before.source, key) : ""}${change.after ? source("Current", change.after.source, key) : ""}</article>`;
}
export function historyHtml(before: Baseline, current: Baseline): string {
	const result = compareHistory(before, current);
	const counts = ["added", "removed", "changed"]
		.map((kind) => `${result.changes.filter((change) => change.kind === kind).length} ${kind}`)
		.join(" · ");
	return `<p>Compared with your observation at <time>${escapeHtml(before.recordedAt)}</time>.</p><p role="status">${counts}</p>${result.changes.length === 0 ? "<p>No source changes since that observation.</p>" : ""}${result.issues.length > 0 ? `<aside aria-label="Identity limitations"><ul>${result.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul><p>Ambiguous identities are compared by source path only.</p></aside>` : ""}${result.changes.map(changeHtml).join("")}`;
}
export function changesHtml(): string {
	return `<section class="history"><h1>Changes since seen</h1><p>Compare current Markdown with one observation you explicitly remember in this browser. This is an observed source comparison, not an event journal, Git history, authorship, or verified acceptance.</p><p>Remembered source can include old or deleted content. One snapshot per workspace, up to 2 MiB, expires after 30 days and is removed on your next workspace visit. Mark seen replaces it; Clear forgets it. No source writes or cloud storage.</p><div class="history-controls"><button id="history-mark" type="button" disabled>Start remembering changes</button><button id="history-clear" type="button" disabled>Clear remembered history</button><span id="history-storage" role="status"></span></div><noscript><p>Remembering and comparing changes requires JavaScript and browser storage. Markdown, Overview and Work remain readable.</p></noscript><div id="changes-content" aria-live="polite"><p>No comparison has been loaded.</p></div></section><style>.history-controls{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}.history-change{border-top:1px solid var(--border);padding:1rem 0}.history-source{white-space:pre-wrap;overflow-wrap:anywhere;max-height:32rem;overflow:auto}.history h2{overflow-wrap:anywhere}</style>`;
}
