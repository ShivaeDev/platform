import { Effect } from "effect";
import { engineScenario } from "#test/engineScenario.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult, NEW_HEAD } from "#test/githubChecks.ts";

export function requiredCheckKeepsFailing() {
	return engineScenario("the required verify check keeps failing at successive heads", () => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		let head = ADOPTED_HEAD;
		return {
			context: {
				github,
				get head() {
					return head;
				},
				set head(value: typeof head) {
					head = value;
				},
			},
			options: { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult(head)) },
		};
	});
}
export function checksAreQueued() {
	return engineScenario("required checks are queued at the adopted head", () => {
		const github = githubFixture();
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "queued" })]]);
		return { context: { github }, options: { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) } };
	});
}
export function checksAreRunning() {
	return engineScenario("required checks are running and repairs can push a new head", () => {
		const github = githubFixture();
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "in_progress" })]]);
		let head = ADOPTED_HEAD;
		return {
			context: {
				github,
				get head() {
					return head;
				},
				set head(value: typeof head) {
					head = value;
				},
			},
			options: { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult(head)) },
		};
	});
}
export function newPushIsGreen() {
	return engineScenario("a newer push is green while the adopted head waits", () => {
		const github = githubFixture();
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "queued" })]]);
		github.reply(NEW_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
		return { context: { github }, options: { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) } };
	});
}
