import { matchOrder, nameMatch, type SearchMatch } from "#browser/search/nameMatch.ts";
import type { Entry } from "./entries.ts";
import { searchSnippet } from "./snippet.ts";

function normalize(text: string): string {
	return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function resultType(entry: Entry): number {
	if (entry.kind === "document" && entry.itemKind) {
		return 0;
	}
	return entry.record ? 2 : 1;
}

function nameFirst(match: SearchMatch): number {
	return Math.min(matchOrder(match), matchOrder("title"));
}

function relevance(entry: Entry, terms: readonly string[], phrase: string, text: string) {
	const identity = normalize(`${entry.title} ${entry.id ?? ""}`);
	const document = entry.kind === "document";
	const titleMatch = document && terms.every((term) => identity.includes(term));
	const ranks = { document: 2, heading: 4, passage: 6 };
	const match: SearchMatch = (document ? nameMatch(entry.title, entry.id, phrase) : undefined) ?? (titleMatch ? "title" : "text");
	return { match, rank: (entry.record ? 10 : 0) + ranks[entry.kind] + (text.includes(phrase) ? 0 : 1) };
}

function located(entry: Entry) {
	return entry.line === undefined ? {} : { line: entry.line };
}

export function searchMatch(entries: readonly Entry[], query: string, modified: ReadonlyMap<string, number> = new Map(), includeRecords = false) {
	const input = normalize(query.slice(0, 200));
	const prefixed = input.startsWith("records:");
	const records = includeRecords || prefixed;
	const phrase = prefixed ? input.slice("records:".length).trim() : input;
	const terms = phrase.split(" ").filter(Boolean).slice(0, 8);
	if (terms.length === 0) {
		return { results: [], total: 0 };
	}
	const items = new Map(entries.filter((entry) => entry.kind === "document" && entry.itemKind).map((entry) => [entry.file, entry]));
	const matches = entries
		.flatMap((entry, order) => {
			const text = normalize(entry.text);
			if ((!records && entry.record) || !terms.every((term) => text.includes(term))) {
				return [];
			}
			const source = entry.kind === "document" ? entry.title : entry.text;
			const snippet = searchSnippet(source, terms[0] ?? "");
			const item = entry.kind === "document" ? undefined : items.get(entry.file);
			return (item ? [item, entry] : [entry]).map((result) => {
				const { match, rank } = relevance(result, terms, phrase, text);
				return {
					entry: { ...result, ...located(entry), match, snippet: normalize(source) === normalize(result.title) ? "" : snippet },
					group: result.inactive ? 1 : 0,
					match,
					modified: modified.get(result.file) ?? 0,
					order,
					rank,
					type: resultType(result),
				};
			});
		})
		.sort(
			(left, right) =>
				nameFirst(left.match) - nameFirst(right.match)
				|| left.type - right.type
				|| matchOrder(left.match) - matchOrder(right.match)
				|| left.group - right.group
				|| right.modified - left.modified
				|| left.rank - right.rank
				|| left.order - right.order,
		);
	const anchors = new Map<string, (typeof matches)[number]["entry"]>();
	for (const match of matches) {
		const kept = anchors.get(match.entry.href);
		if (!kept) {
			anchors.set(match.entry.href, match.entry);
		} else if (!kept.snippet && match.entry.snippet) {
			anchors.set(match.entry.href, { ...kept, ...located(match.entry), snippet: match.entry.snippet });
		}
	}
	const results = [...anchors.values()];
	return { results: results.slice(0, 40), total: results.length };
}
