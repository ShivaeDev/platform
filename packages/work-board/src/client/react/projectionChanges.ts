import { matches } from "#client/reconcile/matches.ts";
import { flash, normalized } from "#client/reconcile/normalized.ts";
export interface RenderedProjection {
	readonly signatures: readonly string[];
	readonly url: string;
}
export function projectionChanges(main: HTMLElement, previous: RenderedProjection | undefined, url: string): RenderedProjection {
	const blocks = [
		...main.querySelectorAll(
			":is(article.doc, .board) :is(p,li,pre,blockquote,h1,h2,h3,h4,h5,h6), .board-head > :is(p,pre,blockquote,h1,h2,h3,h4,h5,h6), .work-card :is(p,h3)",
		),
	].filter((element) => !(element.matches("[data-modified]") || element.querySelector("[data-modified]")));
	const signatures = blocks.map(normalized);
	if (previous?.url === url) {
		const kept = new Set(matches(previous.signatures, signatures).map(([, index]) => index));
		for (const [index, element] of blocks.entries()) {
			if (!kept.has(index)) {
				flash(element);
			}
		}
	}
	return { signatures, url };
}
