import { Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedBody } from "@shivaedev/http/body.ts";
import { authenticatedRequest } from "./authenticatedRequest.ts";
import { GitHubArtifactError, GitHubArtifactTooLarge, GitHubTransportError } from "./errors.ts";
import type { GitHubToken } from "./GitHubToken.ts";
import type { RateLimits } from "./rateLimits.ts";
import type { TokenRefresh } from "./TokenRefresh.ts";

export interface ArtifactArchiveOptions {
	readonly artifactId: number;
	readonly byteLimit: number;
	readonly owner: string;
	readonly repo: string;
}

export function artifacts(
	apiUrl: string,
	client: HttpClient.HttpClient,
	token: GitHubToken["Service"],
	rates: RateLimits,
	refresh: typeof TokenRefresh.Service = undefined,
) {
	const send = authenticatedRequest(HttpClient.withScope(client), token, rates, refresh);
	const download = HttpClient.withScope(client);
	return {
		downloadArtifactArchive: (options: ArtifactArchiveOptions) =>
			Effect.scoped(
				Effect.gen(function* () {
					const path = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/actions/artifacts/${options.artifactId}/zip`;
					const redirect = yield* send(HttpClientRequest.get(new URL(path, apiUrl).href, { accept: "application/vnd.github+json" }), "manual").pipe(
						Effect.catchTags({
							RemoteGone: (error) => Effect.fail(new GitHubArtifactError({ stage: "redirect", status: error.status })),
							RemoteNotFound: (error) => Effect.fail(new GitHubArtifactError({ stage: "redirect", status: error.status })),
						}),
					);
					const location = redirect.headers.location;
					if (redirect.status !== 302 || location === undefined) {
						return yield* new GitHubArtifactError({ stage: "redirect", status: redirect.status });
					}
					const response = yield* download.get(location).pipe(
						Effect.provideService(FetchHttpClient.RequestInit, { credentials: "omit", redirect: "manual" }),
						Effect.mapError(() => new GitHubTransportError({ path })),
					);
					if (response.status < 200 || response.status >= 300) {
						return yield* new GitHubArtifactError({ stage: "download", status: response.status });
					}
					return yield* readBoundedBody(response, options.byteLimit).pipe(
						Effect.catchTags({
							HttpClientError: () => Effect.fail(new GitHubTransportError({ path })),
							ResponseBodyTooLarge: ({ limit }) => Effect.fail(new GitHubArtifactTooLarge({ limit })),
						}),
					);
				}),
			),
	};
}
