import type { Entry } from "./entries.ts";

function normalize(text: string): string {
	return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

export function searchMatch(entries: readonly Entry[], query: string) {
	const phrase = normalize(query.slice(0, 200));
	const terms = phrase.split(" ").filter(Boolean).slice(0, 8);
	if (terms.length === 0) {
		return { results: [], total: 0 };
	}
	const matches = entries
		.flatMap((entry, order) => {
			const text = normalize(entry.text);
			if (!terms.every((term) => text.includes(term))) {
				return [];
			}
			const at = Math.max(0, entry.text.toLowerCase().indexOf(terms[0] ?? ""));
			const start = Math.max(0, at - 50);
			const snippet = (start ? "…" : "") + entry.text.slice(start, start + 180) + (entry.text.length > start + 180 ? "…" : "");
			const ranks = { document: 0, heading: 2, passage: 4 };
			const rank = ranks[entry.kind] + (text.includes(phrase) ? 0 : 1);
			return [{ entry: { ...entry, snippet }, order, rank }];
		})
		.sort((left, right) => left.rank - right.rank || left.order - right.order);
	return { results: matches.slice(0, 40).map((match) => match.entry), total: matches.length };
}
