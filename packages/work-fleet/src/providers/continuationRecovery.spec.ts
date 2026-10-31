import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cloudRecovery, timedProviderStory } from "#test/providerStory.ts";
import { page, turn } from "#test/wireScript.ts";

const MISSING = "session ambiguous (session-turn-missing): No matching accepted turn is observable; absence does not authorize replay";
const QUESTION = page([turn("question-turn", "completed", "question-operation")]);

for (const [evidence, appears, expected] of [
	["the answer's turn", page([turn("answer-turn", "inProgress", "answer-operation")]), "turn answer-turn on thread"],
	["only an unrelated turn", QUESTION, MISSING],
	["no turn", page([]), MISSING],
] as const) {
	timedProviderStory.it(
		`a continuation on a non-empty thread waits its whole grace period and ${expected === MISSING ? "fails as missing" : "adopts the turn"} when ${evidence} is visible at the deadline`,
		[cloudRecovery(5000)],
		function* ({ answers, delayNearlyElapses, finalMillisecondElapses, methods, provider, recoveryPollsElapse }) {
			yield* answers({ "thread/turns/list": QUESTION });
			const recovery = yield* provider.recoverInBackground({
				operationId: "answer-operation",
				resume: { prompt: "Recorded answer" },
				sessionId: "thread",
			});
			yield* recoveryPollsElapse(19);
			yield* delayNearlyElapses(250);
			expect(yield* recovery.progress()).toBe("pending");
			yield* answers({ "thread/turns/list": appears });

			yield* finalMillisecondElapses();

			yield* outcomes([
				["recovery", () => recovery.outcome(), expected],
				["replayed calls", () => methods("turn/start", "thread/start"), []],
			]);
		},
	);
}
