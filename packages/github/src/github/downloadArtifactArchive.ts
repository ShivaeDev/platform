import { Effect } from "effect";
import { HttpClient, type HttpClientError, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { readBoundedBody } from "@shivaedev/http/body.ts";
import type { RemoteStatusError } from "@shivaedev/http/errors.ts";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
import type { ArtifactArchiveOptions } from "#ArtifactArchiveOptions.ts";
import { extractArtifactArchive } from "#artifactExtraction.ts";
import { authenticatedRequest } from "#authenticatedRequest.ts";
import { GitHubArtifactError, GitHubArtifactTooLarge, GitHubTransportError } from "#errors.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { manualRedirects } from "#manualRedirects.ts";
import { resolveApiUrl } from "#resolveApiUrl.ts";

function downloadFailure(path: string, cause: HttpClientError.HttpClientError | RemoteStatusError) {
	return cause._tag === "HttpClientError"
		? new GitHubTransportError({ path }, { cause })
		: new GitHubArtifactError({ stage: "download", status: cause.status });
}

export function downloadArtifactArchive({ rates }: GitHubState) {
	return Effect.fn("GitHub.downloadArtifactArchive")(function* (options: ArtifactArchiveOptions) {
		const { apiUrl } = yield* GitHubConfig;
		const download = filterStatus(HttpClient.withScope(yield* HttpClient.HttpClient));
		const send = authenticatedRequest(rates);
		const path = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/actions/artifacts/${options.artifactId}/zip`;
		const redirect = yield* send(HttpClientRequest.get(resolveApiUrl(apiUrl, path), { accept: "application/vnd.github+json" }), "manual").pipe(
			Effect.catchTag("RemoteGone", (error) => Effect.fail(new GitHubArtifactError({ stage: "redirect", status: error.status }, { cause: error }))),
			Effect.catchTag("RemoteNotFound", (error) =>
				Effect.fail(new GitHubArtifactError({ stage: "redirect", status: error.status }, { cause: error })),
			),
		);
		const location = redirect.headers.location;
		if (redirect.status !== HttpStatus.fromLiteral("Found") || location === undefined) {
			return yield* new GitHubArtifactError({ stage: "redirect", status: redirect.status });
		}
		const response = yield* manualRedirects(download.get(location)).pipe(Effect.mapError((cause) => downloadFailure(path, cause)));
		return yield* readBoundedBody(response, options.byteLimit).pipe(
			Effect.catchTag("HttpClientError", (cause) => Effect.fail(new GitHubTransportError({ path }, { cause }))),
			Effect.catchTag("ResponseBodyTooLarge", (cause) => Effect.fail(new GitHubArtifactTooLarge({ limit: cause.limit }, { cause }))),
			Effect.flatMap((bytes) => extractArtifactArchive(bytes, options)),
		);
	}, Effect.scoped);
}
