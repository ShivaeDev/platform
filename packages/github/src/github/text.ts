import { Effect } from "effect";
import { GitHubConfig } from "#GitHubConfig.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { representationRequest } from "#representationRequest.ts";
import { requests } from "#requests.ts";

export function text(state: GitHubState) {
	return Effect.fn("GitHub.text")(function* (path: string, accept: string, limit: number) {
		const { apiUrl } = yield* GitHubConfig;
		const request = requests(state);
		return yield* Effect.map(request(representationRequest(apiUrl, path, accept), limit), (entry) => new TextDecoder().decode(entry.bytes));
	});
}
