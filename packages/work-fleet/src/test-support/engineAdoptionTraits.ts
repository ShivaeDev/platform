import { Effect } from "effect";
import { githubDelivery } from "#host/githubDelivery.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { checkRun, githubFixture } from "#test/githubChecks.ts";
import { BASE, HEAD, MOVED, PR, resultFixture } from "#test/githubResult.ts";

export function workerReportsChangedPaths() {
	return engineConfiguration("the worker reports a pull request with one changed path", (state) => {
		const github = resultFixture({ after: { "changed_files": 1 }, before: { "changed_files": 1 }, files: [[{ filename: "src/one.ts" }]] });
		state.adoption = github;
		return { resultQuery: github.adopt, reviewRunning: true };
	});
}
export function workerReportsNoChange() {
	return engineConfiguration("the worker reports no change for independent review", (state) => {
		const github = resultFixture();
		state.adoption = github;
		return { resultQuery: github.adopt, reviewRunning: true };
	});
}
export function mainMovesBeforeNoChange() {
	return engineConfiguration("main moves before the no-change result is adopted", (state) => {
		const github = resultFixture({ mainHead: MOVED });
		state.adoption = github;
		return { resultQuery: github.adopt };
	});
}
export function reportedPullRequestIsClosed() {
	return engineConfiguration("the reported pull request is closed without merging", (state) => {
		const github = resultFixture({ before: { state: "closed" } });
		state.adoption = github;
		return { resultQuery: github.adopt };
	});
}
export function pullRequestIsBehindMain() {
	return engineConfiguration("the pull request is conflict-free and behind main", (state) => {
		const adopted = resultFixture({
			after: { base: { ref: "main", sha: MOVED }, "changed_files": 1 },
			before: { "changed_files": 1 },
			files: [[{ filename: "src/one.ts" }]],
			mainHead: MOVED,
		});
		const github = githubFixture("example/repository");
		github.reply(HEAD, [[checkRun({ headSha: HEAD })]]);
		const checkedHeads: string[] = [];
		const open = {
			baseRefOid: BASE,
			headRefOid: HEAD,
			mergeable: "MERGEABLE",
			mergeCommit: null,
			mergedAt: null,
			mergeStateStatus: "BEHIND",
			state: "OPEN",
			url: PR,
		};
		state.pullObservation = open;
		state.adoption = adopted;
		state.checkedHeads = checkedHeads;
		state.checks = github;

		return {
			checksQuery: (result) => {
				checkedHeads.push(result.head);
				return github.checks(result);
			},
			deliveryQuery: githubDelivery(() => Effect.succeed(state.pullObservation)),
			resultQuery: adopted.adopt,
		};
	});
}
export function pullRequestHeadCanMove() {
	return engineConfiguration("the reported pull request can move while review runs", (state) => {
		state.resultHead = "first-head";
		return {
			resultQuery: () =>
				Effect.succeed({ head: state.resultHead, kind: "change" as const, paths: ["src/one.ts"], pr: "https://example.invalid/pr/one" }),
			reviewRunning: true,
		};
	});
}
