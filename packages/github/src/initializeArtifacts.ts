import { Effect } from "effect";
import { HttpClient } from "effect/http";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
import { authenticatedRequest } from "#authenticatedRequest.ts";
import { GitHubToken } from "#GitHubToken.ts";
import type { RateLimits } from "#rateLimits.ts";
import { TokenRefresh } from "#TokenRefresh.ts";

export const initializeArtifacts = Effect.fn("GitHub.initializeArtifacts")(function* (apiUrl: string, rates: RateLimits) {
	const client = yield* HttpClient.HttpClient;
	const token = yield* GitHubToken;
	const refresh = yield* TokenRefresh;
	const send = authenticatedRequest(HttpClient.withScope(client), token, rates, refresh);
	const download = filterStatus(HttpClient.withScope(client));
	return { apiUrl, download, send };
});
