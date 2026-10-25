import type { EngineStory } from "#test/engineState.ts";

export function githubReadRetry(state: EngineStory, tell: (line: string) => void) {
	return {
		failGithubReads: (count: number) => {
			if (state.github === undefined) {
				throw new Error("No loopback GitHub provider is configured");
			}
			state.github.state.unavailableReads = count;
			tell(`GitHub fails its next ${count} reads`);
		},
	};
}
