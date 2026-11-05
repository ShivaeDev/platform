import { Effect } from "effect";
import { GitHubConfig } from "#GitHubConfig.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { representationRequest } from "#representationRequest.ts";
import { requests } from "#requests.ts";

export function bytes(state: GitHubState) {
	return Effect.fn("GitHub.bytes")(function* (path: string, accept: string, limit: number) {
		const { apiUrl } = yield* GitHubConfig;
		const request = requests(state);
		return yield* Effect.map(request(representationRequest(apiUrl, path, accept), limit), (entry) => new Uint8Array(entry.bytes));
	});
}
