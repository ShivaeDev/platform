import { Effect } from "effect";
import { FetchHttpClient, HttpClient, type HttpClientError, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { readBoundedBody } from "@shivaedev/http/body.ts";
import type { RemoteStatusError } from "@shivaedev/http/errors.ts";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
import { type ArtifactExtractionOptions, extractArtifactArchive } from "#artifactExtraction.ts";
import { authenticatedRequest } from "#authenticatedRequest.ts";
import { GitHubArtifactError, GitHubArtifactTooLarge, GitHubTransportError } from "#errors.ts";
import { GitHubToken } from "#GitHubToken.ts";
import type { RateLimits } from "#rateLimits.ts";
import { TokenRefresh } from "#TokenRefresh.ts";

export interface ArtifactArchiveOptions extends ArtifactExtractionOptions {
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

export const artifacts = Effect.fn("GitHub.artifacts")(function* (apiUrl: string, rates: RateLimits) {
	const client = yield* HttpClient.HttpClient;
	const token = yield* GitHubToken;
	const refresh = yield* TokenRefresh;
	const send = authenticatedRequest(HttpClient.withScope(client), token, rates, refresh);
	const download = filterStatus(HttpClient.withScope(client));
	return {
		downloadArtifactArchive: Effect.fn("GitHub.downloadArtifactArchive")(function* (options: ArtifactArchiveOptions) {
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
				Effect.flatMap((bytes) => extractArtifactArchive(bytes, options)),
			);
		}, Effect.scoped),
	};
});
