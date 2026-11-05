import { Effect } from "effect";
import { GitHubConfig } from "#GitHubConfig.ts";
import type { GitHubState } from "#initializeGitHub.ts";
export function resource({ rates }: GitHubState) {
	return Effect.fn("GitHub.resource")(function* (path: string) {
		const { apiUrl } = yield* GitHubConfig;
		return rates.resource(new URL(path, apiUrl).pathname);
	});
}
