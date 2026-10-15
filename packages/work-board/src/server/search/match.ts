import type { Entry } from "./entries.ts";
import { searchSnippet } from "./snippet.ts";

function normalize(text: string): string {
	return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function resultType(entry: Entry): number {
	if (entry.record) {
		return 2;
	}
	return entry.kind === "document" && entry.itemKind ? 0 : 1;
}

function relevance(entry: Entry, terms: readonly string[], phrase: string, text: string) {
	const identity = normalize(`${entry.title} ${entry.id ?? ""}`);
	const titleMatch = entry.kind === "document" && terms.every((term) => identity.includes(term));
	const ranks = { document: 2, heading: 4, passage: 6 };
	return { rank: (entry.record ? 10 : 0) + ranks[entry.kind] + (text.includes(phrase) ? 0 : 1), title: titleMatch ? 0 : 1 };
}

export function searchMatch(entries: readonly Entry[], query: string, modified: ReadonlyMap<string, number> = new Map()) {
	const input = normalize(query.slice(0, 200));
	const records = input.startsWith("records:");
	const phrase = records ? input.slice("records:".length).trim() : input;
	const terms = phrase.split(" ").filter(Boolean).slice(0, 8);
	if (terms.length === 0) {
		return { results: [], total: 0 };
	}
	const items = new Map(entries.filter((entry) => entry.kind === "document" && entry.itemKind && !entry.record).map((entry) => [entry.file, entry]));
	const matches = entries
		.flatMap((entry, order) => {
			const text = normalize(entry.text);
			if ((!records && entry.record) || !terms.every((term) => text.includes(term))) {
				return [];
			}
			const snippet = searchSnippet(entry.kind === "document" ? entry.title : entry.text, terms[0] ?? "");
			const item = entry.kind === "document" ? undefined : items.get(entry.file);
			return (item ? [item, entry] : [entry]).map((result) => ({
				...relevance(result, terms, phrase, text),
				entry: { ...result, snippet },
				group: result.inactive ? 1 : 0,
				modified: modified.get(result.file) ?? 0,
				order,
				type: resultType(result),
			}));
		})
		.sort(
			(left, right) =>
				left.type - right.type
				|| left.group - right.group
				|| left.title - right.title
				|| right.modified - left.modified
				|| left.rank - right.rank
				|| left.order - right.order,
		);
	const anchors = new Map<string, (typeof matches)[number]["entry"]>();
	for (const match of matches) {
		anchors.set(match.entry.href, anchors.get(match.entry.href) ?? match.entry);
	}
	const results = [...anchors.values()];
	return { results: results.slice(0, 40), total: results.length };
}
