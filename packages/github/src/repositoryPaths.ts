import type { RepositoryListOptions } from "#repositoryReads.ts";

export function repository(owner: string, repo: string) {
	return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
export function pathWithQuery<E>(path: string, options?: RepositoryListOptions<E>) {
	const query = new URLSearchParams({ "per_page": "100" });
	for (const [key, value] of Object.entries(options?.query ?? {})) {
		if (value !== undefined) {
			query.set(key, String(value));
		}
	}
	return `${path}?${query}`;
}
