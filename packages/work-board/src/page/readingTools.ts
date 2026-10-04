import type { Heading } from "#render/documentHeadings.ts";
import { escapeHtml } from "./escape.ts";

export function readingTools(headings: readonly Heading[]): string {
	const outline =
		headings.length === 0
			? ""
			: `<details class="outline" data-key="outline"><summary>On this page</summary><nav aria-label="Document outline"><ol>${headings
					.map(({ depth, id, title }) => `<li data-depth="${depth}"><a href="#${escapeHtml(id)}">${escapeHtml(title || "Section")}</a></li>`)
					.join("")}</ol></nav></details>`;
	return `<div class="reading-tools"><button id="favorite-toggle" type="button" aria-pressed="false" disabled>Save favorite</button>${outline}</div>`;
}
