export const searchMatches = ["exact", "prefix", "title", "text"] as const;
export type SearchMatch = (typeof searchMatches)[number];

export function matchOrder(match: SearchMatch): number {
	return searchMatches.indexOf(match);
}

function searchWords(text: string): string {
	return text
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

export function nameMatch(title: string, id: string | undefined, phrase: string): "exact" | "prefix" | undefined {
	const wanted = searchWords(phrase);
	if (!wanted) {
		return undefined;
	}
	const names = [title, id ?? "", id?.split(".").at(-1) ?? ""].map(searchWords).filter(Boolean);
	if (names.includes(wanted)) {
		return "exact";
	}
	// One word starts too many titles to outrank status and recency.
	return wanted.includes(" ") && names.some((name) => name.startsWith(wanted)) ? "prefix" : undefined;
}
