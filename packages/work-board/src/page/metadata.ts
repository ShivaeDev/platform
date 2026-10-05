import { identityUrl } from "#metadata/links.ts";
import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { escapeHtml } from "./escape.ts";
import { metadataDetails } from "./metadataDetails.ts";

export function metadataHtml(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const diagnostics = model.diagnostics.get(file) ?? parsed.diagnostics;
	if (parsed.raw === undefined && diagnostics.length === 0) {
		return "";
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
	return `<section class="work-meta" aria-label="Recorded work"><p class="metadata-summary">Recorded work · ${identity}${fields.status ? ` · ${escapeHtml(fields.status)}` : ""}${fields.owner ? ` · ${escapeHtml(fields.owner)}` : ""}</p>${fields.nextAction ? `<p>Next action: ${escapeHtml(fields.nextAction)}</p>` : ""}${problems}<details data-key="work-metadata"><summary>Work details and source</summary>${details}<p>Source: ${escapeHtml(file)}:${parsed.lines.id ?? 1}; prose starts at line ${parsed.bodyLine}.</p>${parsed.raw ? `<details data-key="frontmatter-source"><summary>Original frontmatter</summary><pre>${escapeHtml(parsed.raw)}</pre></details>` : ""}</details></section>`;
}

export const metadataStyles = `
.work-meta{font-size:.9rem;margin:16px 0 24px;padding:12px 16px;border:1px solid var(--border);border-radius:8px;background:var(--surface);overflow-wrap:anywhere}
.metadata-summary{font-weight:600;margin:0}.work-meta>p{margin-bottom:8px}.work-meta details{margin:0}.work-meta summary{color:var(--link)}
.work-meta dl{display:grid;grid-template-columns:minmax(80px,auto) minmax(0,1fr);gap:4px 12px;margin:12px 0}.work-meta dt{color:var(--muted)}.work-meta dd{margin:0}
.work-meta pre{max-height:300px;overflow:auto;margin-top:12px}.metadata-problems{color:var(--danger);margin:12px 0}.metadata-problems ul{margin:4px 0 12px;padding-left:20px}
[id^="criterion-"]{scroll-margin-top:20px}
`;
