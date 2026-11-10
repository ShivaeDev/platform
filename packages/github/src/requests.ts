import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";
import { readBoundedBody } from "@shivaedev/http/body.ts";
import { ResponseBodyTooLarge } from "@shivaedev/http/errors.ts";
import { authenticatedRequest } from "#authenticatedRequest.ts";
import { type CachedResponse, revalidatedResponse } from "#cache.ts";
import { GitHubTransportError } from "#errors.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { mergeResponseHeaders } from "#mergeResponseHeaders.ts";
import { isUnchanged } from "#status.ts";

export function requests({ cache, rates }: GitHubState) {
	return Effect.fn("GitHub.request")(function* (input: HttpClientRequest.HttpClientRequest, limit: number) {
		const key = JSON.stringify([input.url, input.urlParams, input.headers.accept]);
		const cached = input.method === "GET" ? cache.get(key) : undefined;
		let request = HttpClientRequest.removeHeader(input, "if-none-match");
		if (cached?.etag !== undefined) {
			request = HttpClientRequest.setHeader(request, "If-None-Match", cached.etag);
		}
		const response = yield* authenticatedRequest(rates)(request, cached === undefined ? undefined : "revalidate");
		if (isUnchanged(response) && cached !== undefined) {
			if (cached.bytes.byteLength > limit) {
				return yield* new ResponseBodyTooLarge({ limit });
			}
			const entry = revalidatedResponse(cached, response);
			cache.set(key, entry);
			return { ...entry, response: mergeResponseHeaders(cached.headers, response) };
		}
		const bytes = yield* readBoundedBody(response, limit).pipe(
			Effect.catchTag("HttpClientError", (cause) => Effect.fail(new GitHubTransportError({ path: new URL(input.url).pathname }, { cause }))),
		);
		const entry: CachedResponse = {
			bytes: new Uint8Array(bytes).buffer,
			decoded: new Map(),
			etag: response.headers.etag,
			headers: response.headers,
			status: response.status,
		};
		if (input.method === "GET" && response.headers.etag !== undefined) {
			cache.set(key, entry);
		}
		return { ...entry, response };
	}, Effect.scoped);
}
