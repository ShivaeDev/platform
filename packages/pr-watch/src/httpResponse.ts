import { Effect } from "effect";
import { WatchError } from "./model.ts";
export interface CachedResponse {
	readonly body: unknown;
	readonly etag: string | null;
	readonly next: string | undefined;
}
function requestHeaders(token: string, cached: CachedResponse | undefined): Headers {
	const headers = new Headers({ Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	if (cached?.etag) {
		headers.set("If-None-Match", cached.etag);
	}
	return headers;
}
export function fetchResponse(url: string, token: string, cached: CachedResponse | undefined) {
	return Effect.tryPromise({
		catch: (cause) => new WatchError({ message: cause instanceof Error ? cause.message : "GitHub request failed" }),
		try: (signal) =>
			fetch(url, { headers: requestHeaders(token, cached), redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) }),
	});
}
export function decodeResponse(url: string, response: Response) {
	return Effect.tryPromise({
		catch: () => new WatchError({ message: "Invalid GitHub response or pagination URL" }),
		try: async () => {
			const body: unknown = await response.json();
			const next = response.headers.get("link")?.match(/<(?<url>[^>]+)>; rel="next"/u)?.groups?.url;
			if (next !== undefined && new URL(next).origin !== new URL(url).origin) {
				throw new Error("Cross-origin pagination refused");
			}
			return { body, etag: response.headers.get("etag"), next } satisfies CachedResponse;
		},
	});
}
