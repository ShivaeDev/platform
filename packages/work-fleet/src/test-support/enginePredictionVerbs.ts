import { type EngineStory, running } from "#test/engineState.ts";
import { prepared } from "#test/preparation.ts";

export function enginePredictionVerbs(state: EngineStory, tell: (line: string) => void) {
	function repository() {
		if (state.predictionRepository === undefined) {
			throw new Error("No prediction repository configured");
		}
		return state.predictionRepository;
	}
	return {
		mergeWatchedPr: (id: string) => {
			repository().merge(id);
			tell(`merge ${id}'s PR`);
		},
		mergeWorkerMain: (id: string, files: Readonly<Record<string, string>>) => {
			repository().mergeMain(id, files);
			tell(`worker ${id} merges main and pushes`);
		},
		predictionWorktree: () => ({ branch: repository().git("branch", "--show-current"), status: repository().git("status", "--porcelain") }),
		preparePredictionWork: (id: string) =>
			running(state).fleet.prepare({
				cwd: repository().cwd,
				preparation: prepared({ ownedPaths: ["."], sourcePaths: ["."] }),
				prompt: `Implement ${id}`,
				workId: id,
			}),
		pushWorkerBranch: (id: string, files: Readonly<Record<string, string>>) => {
			repository().push(id, files);
			tell(`worker ${id} pushes its branch and opens a PR`);
		},
		reserveWatchedPr: (id: string) => running(state).fixture.foreign(repository().result(id).pr),
	};
}
