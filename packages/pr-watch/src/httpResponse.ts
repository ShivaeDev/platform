import { Effect } from "effect";
import { type HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import { WatchError } from "./model.ts";
export interface CachedResponse {
	readonly body: unknown;
	readonly etag: string | null;
	readonly next: string | undefined;
}
export function fetchResponse(client: HttpClient.HttpClient, url: string, token: string, cached: CachedResponse | undefined, body?: unknown) {
	const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	if (cached?.etag) {
		headers["If-None-Match"] = cached.etag;
	}
	return body === undefined
		? client.get(url, { headers })
		: HttpClientRequest.post(url, { headers }).pipe(HttpClientRequest.bodyJson(body), Effect.flatMap(client.execute));
}
export function decodeResponse(url: string, response: HttpClientResponse.HttpClientResponse) {
	return Effect.gen(function* () {
		if (response.status < 200 || response.status >= 300) {
			return yield* Effect.fail(new WatchError({ message: `GitHub HTTP ${response.status} for ${new URL(url).pathname}` }));
		}
		const body = yield* response.json;
		const next = response.headers.link?.match(/<(?<url>[^>]+)>; rel="next"/u)?.groups?.url;
		yield* Effect.try(() => {
			if (next !== undefined && new URL(next).origin !== new URL(url).origin) {
				throw new Error("Cross-origin pagination refused");
			}
		});
		return { body, etag: response.headers.etag ?? null, next } satisfies CachedResponse;
	}).pipe(
		Effect.mapError((cause) => (cause instanceof WatchError ? cause : new WatchError({ message: "Invalid GitHub response or pagination URL" }))),
	);
}
