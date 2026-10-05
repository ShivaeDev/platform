import { Effect } from "effect";
import { identityUrl } from "#metadata/links.ts";
import { escapeHtml } from "#page/escape.ts";
import { metadataHtml } from "#page/metadata.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { renderMarkdown } from "#render/markdown.ts";
import type { Snapshot } from "#search/snapshot.ts";
import type { Projection } from "./projection.ts";
import { type State, viewUrl } from "./state.ts";

export const workDetail = Effect.fn("WorkBoard.workDetail")(function* (projection: Projection, state: State, snapshot: Snapshot) {
	if (!state.item) {
		return "";
	}
	const close = `<a class="detail-close" href="${escapeHtml(viewUrl(state, { item: "" }, "work-results"))}">Close detail</a>`;
	const selected = projection.selected;
	if (!selected) {
		const ambiguous = (snapshot.model.ids.get(state.item)?.length ?? 0) > 1;
		return `<aside id="work-detail" class="work-detail" tabindex="-1" aria-label="Selected work">${close}<h2>Item unavailable</h2><p>${escapeHtml(state.item)} ${ambiguous ? "has a duplicate ID" : "is missing or its identity changed"}. No source was selected.</p><a href="${escapeHtml(identityUrl(state.item))}">Inspect item identity</a></aside>`;
	}
	const { document } = selected;
	const prose = yield* renderMarkdown(document.parsed.body, { file: document.file, headings: documentHeadings() });
	return `<aside id="work-detail" class="work-detail" data-key="detail:${escapeHtml(selected.id)}" tabindex="-1" aria-label="Selected work">
 <header>${close}<a href="${escapeHtml(identityUrl(selected.id))}">Open document</a></header>
 ${projection.selectedOutside ? '<p class="detail-notice" role="status">This selected item is outside the current board or filters.</p>' : ""}
 <p class="meta">Source: ${escapeHtml(document.file)}</p>${metadataHtml(document.parsed, document.file, snapshot.model)}
 <article class="doc">${prose}</article></aside>`;
});
