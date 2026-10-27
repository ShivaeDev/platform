export function parseSearch(search: string): Record<string, string> {
	return Object.fromEntries(new URLSearchParams(search));
}

export function stringifySearch(search: Record<string, unknown>): string {
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
