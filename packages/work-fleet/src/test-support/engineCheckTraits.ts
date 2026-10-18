import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult, NEW_HEAD } from "#test/githubChecks.ts";

export function optionalCheckFails() {
	return engineConfiguration("an optional check fails while required verify passes", (state) => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" }), checkRun({ conclusion: "failure", name: "publish" })]]);
		state.checks = github;
		return { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) };
	});
}
export function requiredChecksFailInSequence() {
	return engineConfiguration("verify fails before a different required build check", (state) => {
		const github = githubFixture();
		github.required(["verify", "build"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" }), checkRun({ name: "build" })]]);
		state.checks = github;
		return { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) };
	});
}
export function reviewAndCheckNeedRepairs() {
	return engineConfiguration("independent review and required checks both need repairs", (state) => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		state.checks = github;
		return { checksQuery: github.checks, repairs: true, resultQuery: () => Effect.succeed(githubResult()) };
	});
}
export function repairKeepsTheSameHead() {
	return engineConfiguration("a check repair keeps the adopted head", (state) => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		state.checks = github;
		return { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) };
	});
}
export function repairSubmissionCanBeRejected() {
	return engineConfiguration("same-head check repairs include a rejected submission", (state) => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		state.providerRejects = false;

		state.checks = github;
		return {
			checksQuery: github.checks,
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) =>
					state.providerRejects && input.access !== "read-only"
						? Effect.fail(new SessionFailure({ message: "Selected model is at capacity", reason: "rejected" }))
						: transport.startTurn(input),
			}),
			resultQuery: () => Effect.succeed(githubResult()),
		};
	});
}
export function requiredCheckKeepsFailing() {
	return engineConfiguration("the required verify check keeps failing at successive heads", (state) => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		state.resultHead = ADOPTED_HEAD;
		state.checks = github;
		return { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult(state.resultHead)) };
	});
}
export function checksAreQueued() {
	return engineConfiguration("required checks are queued at the adopted head", (state) => {
		const github = githubFixture();
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "queued" })]]);
		state.checks = github;
		return { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) };
	});
}
export function checksAreRunning() {
	return engineConfiguration("required checks are running and repairs can push a new head", (state) => {
		const github = githubFixture();
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "in_progress" })]]);
		state.resultHead = ADOPTED_HEAD;
		state.checks = github;
		return { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult(state.resultHead)) };
	});
}
export function newPushIsGreen() {
	return engineConfiguration("a newer push is green while the adopted head waits", (state) => {
		const github = githubFixture();
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "queued" })]]);
		github.reply(NEW_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
		state.checks = github;
		return { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) };
	});
}
