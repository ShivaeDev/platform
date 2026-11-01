import { Effect } from "effect";
import { FetchHttpClient, HttpClient, type HttpClientError, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { readBoundedBody } from "@shivaedev/http/body.ts";
import type { RemoteStatusError } from "@shivaedev/http/errors.ts";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
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

function downloadFailure(path: string, cause: HttpClientError.HttpClientError | RemoteStatusError) {
	return cause._tag === "HttpClientError"
		? new GitHubTransportError({ path }, { cause })
		: new GitHubArtifactError({ stage: "download", status: cause.status });
}

export function artifacts(
	apiUrl: string,
	client: HttpClient.HttpClient,
	token: GitHubToken["Service"],
	rates: RateLimits,
	refresh: typeof TokenRefresh.Service = undefined,
) {
	const send = authenticatedRequest(HttpClient.withScope(client), token, rates, refresh);
	const download = filterStatus(HttpClient.withScope(client));
	return {
		downloadArtifactArchive: (options: ArtifactArchiveOptions) =>
			Effect.scoped(
				Effect.gen(function* () {
					const path = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/actions/artifacts/${options.artifactId}/zip`;
					const redirect = yield* send(HttpClientRequest.get(new URL(path, apiUrl).href, { accept: "application/vnd.github+json" }), "manual").pipe(
						Effect.catchTags({
							RemoteGone: (error) => Effect.fail(new GitHubArtifactError({ stage: "redirect", status: error.status }, { cause: error })),
							RemoteNotFound: (error) => Effect.fail(new GitHubArtifactError({ stage: "redirect", status: error.status }, { cause: error })),
						}),
					);
					const location = redirect.headers.location;
					if (redirect.status !== HttpStatus.fromLiteral("Found") || location === undefined) {
						return yield* new GitHubArtifactError({ stage: "redirect", status: redirect.status });
					}
					const response = yield* download.get(location).pipe(
						Effect.provideService(FetchHttpClient.RequestInit, { credentials: "omit", redirect: "manual" }),
						Effect.mapError((cause) => downloadFailure(path, cause)),
					);
					return yield* readBoundedBody(response, options.byteLimit).pipe(
						Effect.catchTags({
							HttpClientError: (cause) => Effect.fail(new GitHubTransportError({ path }, { cause })),
							ResponseBodyTooLarge: (cause) => Effect.fail(new GitHubArtifactTooLarge({ limit: cause.limit }, { cause })),
						}),
					);
				}),
			),
	};
}
