import type { HttpClientResponse } from "effect/http";

export interface CachedResponse {
	readonly bytes: ArrayBuffer;
	readonly decoded: Map<object, unknown>;
	readonly etag?: string | undefined;
	readonly headers: HttpClientResponse.HttpClientResponse["headers"];
	readonly status: HttpClientResponse.HttpClientResponse["status"];
}

export function revalidatedResponse(cached: CachedResponse, response: HttpClientResponse.HttpClientResponse): CachedResponse {
	return { ...cached, etag: response.headers.etag ?? cached.etag, headers: { ...cached.headers, ...response.headers }, status: response.status };
}

export function responseCache() {
	const entries = new Map<string, CachedResponse>();
	return {
		get: (key: string) => entries.get(key),
		set(key: string, entry: CachedResponse) {
			entries.delete(key);
			const { bytes, decoded, etag, headers, status } = entry;
			entries.set(key, { bytes, decoded, etag, headers, status });
			if (entries.size > 1000) {
				const first = entries.keys().next();
				if (!first.done) {
					entries.delete(first.value);
				}
			}
		},
	};
}
