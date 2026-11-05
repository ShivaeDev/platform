import { Cache, Effect } from "effect";
import type { initializeGitHubApp } from "#initializeGitHubApp.ts";
export function viewerRepositories(viewers: Effect.Success<typeof initializeGitHubApp>) {
	return Effect.fn("GitHubApp.viewerRepositories")((account: number | string) =>
		Cache.get(viewers, typeof account === "number" ? `id:${account}` : `login:${account.toLowerCase()}`),
	);
}
