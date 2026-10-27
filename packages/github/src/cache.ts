import type { Schema } from "effect";
import type { HttpClientResponse } from "effect/http";

export interface CachedResponse {
	readonly bytes: Uint8Array;
	readonly decoded: Map<Schema.Constraint, unknown>;
	readonly response: HttpClientResponse.HttpClientResponse;
}

export function responseCache() {
	const entries = new Map<string, CachedResponse>();
	return {
		get: (key: string) => entries.get(key),
		set(key: string, entry: CachedResponse) {
			entries.delete(key);
			entries.set(key, entry);
			if (entries.size > 1000) {
				const first = entries.keys().next();
				if (!first.done) {
					entries.delete(first.value);
				}
			}
		},
	};
}
