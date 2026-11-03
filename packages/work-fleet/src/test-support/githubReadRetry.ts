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
		omitLastChangedFile: () => {
			const pages = state.github?.state.filePages;
			if (state.github === undefined || pages === undefined || pages.length === 0) {
				throw new Error("No paginated GitHub file listing is configured");
			}
			state.github.state.filePages = pages.map((page, index) => (index === pages.length - 1 ? page.slice(0, -1) : page));
			tell("GitHub omits the last changed file while still reporting the full count");
		},
	};
}
