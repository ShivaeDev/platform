import { identityUrl } from "#metadata/links.ts";
import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { backlinksHtml } from "#page/backlinksHtml.ts";
import { escapeHtml } from "#page/escape.ts";
import { metadataDetails } from "#page/metadataDetails.ts";
import { stateOf, viewUrl } from "#views/state.ts";

function handoffLink(id: string | undefined, kind: string | undefined, unique: boolean) {
	return unique && id && !["question", "response", "handoff"].includes(kind ?? "")
		? `<p><a href="/_board/handoff?item=${encodeURIComponent(id)}">Prepare an agent handoff</a></p>`
		: "";
}

function resultLink(id: string | undefined, kind: string | undefined, unique: boolean) {
	return unique && id && kind === "result" ? `<p><a href="/_board/result?item=${encodeURIComponent(id)}">Review returned result</a></p>` : "";
}

export function metadataHtml(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const backlinks = backlinksHtml(file, model);
	const diagnostics = model.diagnostics.get(file) ?? parsed.diagnostics;
	if (parsed.raw === undefined && diagnostics.length === 0) {
		return backlinks;
	}
	const fields = parsed.fields;
	const unique = model.unavailable.length === 0 && fields.id !== undefined && model.ids.get(fields.id)?.length === 1;
	const problems =
		diagnostics.length > 0
			? `<div class="metadata-problems" role="status"><b>Source diagnostics</b><ul>${diagnostics.map((problem) => `<li>${escapeHtml(file)}:${problem.line} — ${escapeHtml(problem.message)}</li>`).join("")}</ul></div>`
			: "";
	const identity =
		unique && fields.id
			? `<a href="${identityUrl(fields.id)}">Item link: ${escapeHtml(fields.id)}</a>`
			: `ID: ${escapeHtml(fields.id ?? "Not recorded")}`;
	const details = metadataDetails(parsed, file, model);
	const boardLink =
		unique && fields.kind === "board" && fields.id
			? `<p><a href="${escapeHtml(viewUrl(stateOf("/"), { board: fields.id }))}">View this board</a></p>`
			: "";
	return `<section class="work-meta" aria-label="Recorded work"><p class="metadata-summary">Recorded work · ${identity}${fields.status ? ` · ${escapeHtml(fields.status)}` : ""}${fields.owner ? ` · ${escapeHtml(fields.owner)}` : ""}</p>${fields.nextAction ? `<p>Next action: ${escapeHtml(fields.nextAction)}</p>` : ""}${boardLink}${resultLink(fields.id, fields.kind, unique)}${handoffLink(fields.id, fields.kind, unique)}${problems}<details data-key="work-metadata"><summary>Work details and source</summary>${details}<p>Source: ${escapeHtml(file)}:${parsed.lines.id ?? 1}; prose starts at line ${parsed.bodyLine}.</p>${parsed.raw ? `<details data-key="frontmatter-source"><summary>Original frontmatter</summary><pre>${escapeHtml(parsed.raw)}</pre></details>` : ""}</details></section>${backlinks}`;
}

export const metadataStyles = `
.work-meta{font-size:.9rem;margin:16px 0 24px;padding:12px 16px;border:1px solid var(--border);border-radius:8px;background:var(--surface);overflow-wrap:anywhere}
.metadata-summary{font-weight:600;margin:0}.work-meta>p{margin-bottom:8px}.work-meta details{margin:0}.work-meta summary{color:var(--link)}
.work-meta dl{display:grid;grid-template-columns:minmax(80px,auto) minmax(0,1fr);gap:4px 12px;margin:12px 0}.work-meta dt{color:var(--muted)}.work-meta dd{margin:0}
.work-meta pre{max-height:300px;overflow:auto;margin-top:12px}.metadata-problems{color:var(--danger);margin:12px 0}.metadata-problems ul{margin:4px 0 12px;padding-left:20px}
.work-context{font-size:.9rem;margin:12px 0 24px;padding:12px 16px;border:1px solid var(--border);border-radius:8px;overflow-wrap:anywhere}.work-context details{margin:0}.work-context ul{margin:12px 0}.work-context p{font-size:13px;color:var(--muted);margin:8px 0 0}
[id^="recorded-evidence-"],[id^="criterion-"]{scroll-margin-top:20px}
`;
