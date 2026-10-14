import type { Entry } from "./entries.ts";
import { searchSnippet } from "./snippet.ts";

function normalize(text: string): string {
	return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

export function searchMatch(entries: readonly Entry[], query: string) {
	const input = normalize(query.slice(0, 200));
	const records = input.startsWith("records:");
	const phrase = records ? input.slice("records:".length).trim() : input;
	const terms = phrase.split(" ").filter(Boolean).slice(0, 8);
	if (terms.length === 0) {
		return { results: [], total: 0 };
	}
	const matches = entries
		.flatMap((entry, order) => {
			const text = normalize(entry.text);
			if ((!records && entry.record) || !terms.every((term) => text.includes(term))) {
				return [];
			}
			const identity = normalize(`${entry.title} ${entry.id ?? ""}`);
			const titleMatch = entry.kind === "document" && terms.every((term) => identity.includes(term));
			const ranks = { document: 2, heading: 4, passage: 6 };
			const rank = (entry.record ? 10 : 0) + (titleMatch ? 0 : ranks[entry.kind]) + (text.includes(phrase) ? 0 : 1);
			const snippet = searchSnippet(entry.kind === "document" ? entry.title : entry.text, terms[0] ?? "");
			return [{ entry: { ...entry, snippet }, order, rank }];
		})
		.sort((left, right) => left.rank - right.rank || left.order - right.order);
	return { results: matches.slice(0, 40).map((match) => match.entry), total: matches.length };
}
