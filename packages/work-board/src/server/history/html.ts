import { escapeHtml } from "#browser/escapeHtml.ts";
import { fileUrl } from "#files/url.ts";
import type { Baseline } from "#history/schema.ts";
import { compareHistory, type SourceChange } from "./compare.ts";

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
