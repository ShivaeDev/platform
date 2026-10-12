import type { Document } from "#browser/document/schema.ts";
export function Reference({ document, target }: { readonly document: Document; readonly target: string }) {
	const href = document.references[target];
	return href ? <a href={href}>{target}</a> : <span>{target} (unresolved, ambiguous, or unavailable)</span>;
}
