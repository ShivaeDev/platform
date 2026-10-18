import { Effect } from "effect";
import { engineScenario } from "#test/engineScenario.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";

export function optionalCheckFails() {
	return engineScenario("an optional check fails while required verify passes", () => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" }), checkRun({ conclusion: "failure", name: "publish" })]]);
		return { context: { github }, options: { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) } };
	});
}
export function requiredChecksFailInSequence() {
	return engineScenario("verify fails before a different required build check", () => {
		const github = githubFixture();
		github.required(["verify", "build"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" }), checkRun({ name: "build" })]]);
		return { context: { github }, options: { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) } };
	});
}
export function reviewAndCheckNeedRepairs() {
	return engineScenario("independent review and required checks both need repairs", () => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		return { context: { github }, options: { checksQuery: github.checks, repairs: true, resultQuery: () => Effect.succeed(githubResult()) } };
	});
}
