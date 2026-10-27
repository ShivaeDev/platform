// Signed URLs depend on their original escapes, even when parsed values match.
const ORIGINAL_SEARCH = Symbol("original search");

interface ParsedSearch extends Record<string, string> {
	readonly [ORIGINAL_SEARCH]: string;
}

export function parseSearch(search: string): ParsedSearch {
	return { ...Object.fromEntries(new URLSearchParams(search)), [ORIGINAL_SEARCH]: search };
}

export function stringifySearch(search: Record<string, unknown>): string {
	if (ORIGINAL_SEARCH in search && typeof search[ORIGINAL_SEARCH] === "string") {
		const original = search[ORIGINAL_SEARCH];
		const parsed = parseSearch(original);
		const entries = Object.entries(search).filter(([, value]) => value !== undefined);
		if (entries.length === Object.keys(parsed).length && entries.every(([key, value]) => parsed[key] === value)) {
			return original;
		}
	}
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(search)) {
		if (value !== undefined) {
			params.set(key, String(value));
		}
	}
	const query = params.toString();
	return query === "" ? "" : `?${query}`;
}

export function returnPath(value: unknown): string {
	if (typeof value !== "string" || !value.startsWith("/")) {
		return "/";
	}
	return new URL(value, window.location.origin).origin === window.location.origin ? value : "/";
}
