import { Effect } from "effect";
import { type HttpClientError, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { readBoundedBody } from "@shivaedev/http/body.ts";
import type { RemoteStatusError } from "@shivaedev/http/errors.ts";
import { manualRedirects } from "#adapters/manualRedirects.ts";
import { resolveApiUrl } from "#adapters/resolveApiUrl.ts";
import { extractArtifactArchive } from "#artifactExtraction.ts";
import type { ArtifactArchiveOptions } from "#artifacts.ts";
import { GitHubArtifactError, GitHubArtifactTooLarge, GitHubTransportError } from "#errors.ts";
import type { initializeArtifacts } from "#initializeArtifacts.ts";

function downloadFailure(path: string, cause: HttpClientError.HttpClientError | RemoteStatusError) {
	return cause._tag === "HttpClientError"
		? new GitHubTransportError({ path }, { cause })
		: new GitHubArtifactError({ stage: "download", status: cause.status });
}

export function downloadArtifactArchive({ apiUrl, send, download }: Effect.Success<ReturnType<typeof initializeArtifacts>>) {
	return Effect.fn("GitHub.downloadArtifactArchive")(function* (options: ArtifactArchiveOptions) {
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
