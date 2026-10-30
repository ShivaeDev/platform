import { Effect } from "effect";
import { type HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedBody } from "@shivaedev/http/body.ts";
import { ResponseBodyTooLarge } from "@shivaedev/http/errors.ts";
import { authenticatedRequest } from "./authenticatedRequest.ts";
import { type CachedResponse, responseCache } from "./cache.ts";
import { GitHubTransportError } from "./errors.ts";
import type { GitHubToken } from "./GitHubToken.ts";
import type { RateLimits } from "./rateLimits.ts";
import { isUnchanged } from "./status.ts";
import type { TokenRefresh } from "./TokenRefresh.ts";

export function requests(
	client: HttpClient.HttpClient,
	token: GitHubToken["Service"],
	rates: RateLimits,
	refresh: typeof TokenRefresh.Service = undefined,
) {
	const cache = responseCache();
	const send = authenticatedRequest(client, token, rates, refresh);
	return Effect.fn("GitHub.request")(function* (input: HttpClientRequest.HttpClientRequest, limit: number) {
		const key = `${input.url} ${input.headers.accept}`;
		const cached = input.method === "GET" ? cache.get(key) : undefined;
		let request = HttpClientRequest.removeHeader(input, "if-none-match");
		if (cached?.response.headers.etag !== undefined) {
			request = HttpClientRequest.setHeader(request, "If-None-Match", cached.response.headers.etag);
		}
		const response = yield* send(request, cached === undefined ? undefined : "revalidate");
		if (isUnchanged(response) && cached !== undefined) {
			if (cached.bytes.byteLength > limit) {
				return yield* new ResponseBodyTooLarge({ limit });
			}
			return cached;
		}
		const bytes = yield* readBoundedBody(response, limit).pipe(
			Effect.catchTag("HttpClientError", (cause) => Effect.fail(new GitHubTransportError({ path: new URL(input.url).pathname }, { cause }))),
		);
		const entry: CachedResponse = { bytes, decoded: new Map(), response };
		if (input.method === "GET" && response.headers.etag !== undefined) {
			cache.set(key, entry);
		}
		return entry;
	});
}
