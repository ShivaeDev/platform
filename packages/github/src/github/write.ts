import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";
import { resolveApiUrl } from "#adapters/resolveApiUrl.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { jsonResponse } from "#json.ts";
import { requests } from "#requests.ts";

export function write(state: GitHubState) {
	return Effect.fn("GitHub.write")(function* (method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, byteLimit?: number) {
		const { apiUrl, responseByteLimit = 1024 * 1024 } = yield* GitHubConfig;
		const request = requests(state);
		return yield* HttpClientRequest.make(method)(resolveApiUrl(apiUrl, path), { headers: { Accept: "application/vnd.github+json" } }).pipe(
			(input) => (body === undefined ? Effect.succeed(input) : HttpClientRequest.bodyJson(input, body)),
			Effect.flatMap((input) => request(input, byteLimit ?? responseByteLimit)),
			Effect.map(jsonResponse),
		);
	});
}
