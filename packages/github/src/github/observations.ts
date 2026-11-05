import { Effect } from "effect";
import type { GitHubState } from "#initializeGitHub.ts";
export function observations({ rates }: GitHubState) {
	return Effect.fn("GitHub.observations")(() => Effect.sync(() => [...rates.observations.values()]));
}
