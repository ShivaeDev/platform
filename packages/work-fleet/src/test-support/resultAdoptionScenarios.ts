import { engineScenario } from "#test/engineScenario.ts";
import { MOVED, resultFixture } from "#test/githubResult.ts";

export function workerReportsChangedPaths() {
	return engineScenario("the worker reports a pull request with one changed path", () => {
		const github = resultFixture({ after: { "changed_files": 1 }, before: { "changed_files": 1 }, files: [[{ filename: "src/one.ts" }]] });
		return { context: { github }, options: { resultQuery: github.adopt, reviewRunning: true } };
	});
}
export function workerReportsNoChange() {
	return engineScenario("the worker reports no change for independent review", () => {
		const github = resultFixture();
		return { context: { github }, options: { resultQuery: github.adopt, reviewRunning: true } };
	});
}
export function mainMovesBeforeNoChange() {
	return engineScenario("main moves before the no-change result is adopted", () => {
		const github = resultFixture({ mainHead: MOVED });
		return { context: { github }, options: { resultQuery: github.adopt } };
	});
}
export function reportedPullRequestIsInvalid(scenario: { options: { before: { state: string } }; output: string }) {
	return engineScenario("the reported pull request is invalid for adoption", () => {
		const github = resultFixture(scenario.options);
		return { context: { github }, options: { resultQuery: github.adopt } };
	});
}
