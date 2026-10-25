import { engineConfiguration } from "#test/engineConfiguration.ts";
import { resultFixture } from "#test/githubResult.ts";

export function workerReportsCanBeAdopted() {
	return engineConfiguration("the reported result is available for adoption", () => ({ resultQuery: resultFixture().adopt }));
}
export function repairReportsCanBeAdopted() {
	return engineConfiguration("review requests repair of an adopted worker report", (state) => {
		const github = resultFixture({ after: { "changed_files": 1 }, before: { "changed_files": 1 }, files: [[{ filename: "src/one.ts" }]] });
		state.adoption = github;
		return { repairs: true, resultQuery: github.adopt };
	});
}
