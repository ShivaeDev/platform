import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineScenario } from "#test/engineScenario.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";

export function repairKeepsTheSameHead() {
	return engineScenario("a check repair keeps the adopted head", () => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		return { context: { github }, options: { checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) } };
	});
}
export function repairSubmissionCanBeRejected() {
	return engineScenario("same-head check repairs include a rejected submission", () => {
		const github = githubFixture();
		github.required(["verify"]);
		github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
		let reject = false;
		let now = 100;
		return {
			context: {
				github,
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
				get reject() {
					return reject;
				},
				set reject(value: typeof reject) {
					reject = value;
				},
			},
			options: {
				checksQuery: github.checks,
				decorateTransport: (transport) => ({
					...transport,
					startTurn: (input) =>
						reject && input.access !== "read-only"
							? Effect.fail(new SessionFailure({ message: "Selected model is at capacity", reason: "rejected" }))
							: transport.startTurn(input),
				}),
				now: () => now,
				resultQuery: () => Effect.succeed(githubResult()),
			},
		};
	});
}
