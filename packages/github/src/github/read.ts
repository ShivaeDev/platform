import { Effect } from "effect";
import { GitHubConfig } from "#GitHubConfig.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { jsonResponse } from "#json.ts";
import { representationRequest } from "#representationRequest.ts";
import { requests } from "#requests.ts";

export function read(state: GitHubState) {
	return Effect.fn("GitHub.read")(function* (path: string, byteLimit?: number) {
		const { apiUrl, responseByteLimit = 1024 * 1024 } = yield* GitHubConfig;
		const request = requests(state);
		return yield* Effect.map(request(representationRequest(apiUrl, path), byteLimit ?? responseByteLimit), jsonResponse);
	});
}
