import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { threadWithPriorTurn } from "#test/codexCloud.ts";
import { cloudRecovery, providerStory } from "#test/providerStory.ts";

const SAVED = { operationId: "saved-operation", resume: { afterTimeout: true, prompt: "Saved prompt" }, sessionId: "thread" };
const MISSING = "session ambiguous (session-turn-missing): No matching accepted turn is observable; absence does not authorize replay";

for (const status of ["completed", "failed", "interrupted"]) {
	providerStory.it(
		`a timed-out continuation whose thread's prior turn is ${status} is resubmitted once with its saved prompt`,
		[cloudRecovery(1)],
		function* ({ answers, methods, provider, sent }) {
			yield* answers(threadWithPriorTurn(status));

			const outcome = yield* provider.recover(SAVED);

			expect(outcome).toBe("turn resubmitted on thread");
			yield* outcomes([
				["new threads", () => methods("thread/start"), []],
				[
					"resubmitted turns",
					() => sent("turn/start"),
					[
						expect.objectContaining({
							clientUserMessageId: "saved-operation",
							input: [expect.objectContaining({ text: "Saved prompt" })],
							threadId: "thread",
						}),
					],
				],
			]);
		},
	);
}

for (const [thread, script, expected] of [
	["its own turn in progress", threadWithPriorTurn("inProgress", "saved-operation"), "turn existing on thread"],
	["another turn in progress", threadWithPriorTurn("inProgress"), MISSING],
	["a turn in an unknown state", threadWithPriorTurn("unknown"), expect.stringMatching(/^session protocol/u)],
] as const) {
	providerStory.it(
		`a timed-out continuation on a thread with ${thread} ${expected === "turn existing on thread" ? "adopts that turn" : "fails"} without resubmitting`,
		[cloudRecovery(1)],
		function* ({ answers, methods, provider }) {
			yield* answers(script);

			const outcome = yield* provider.recover(SAVED);

			expect(outcome).toEqual(expected);
			expect(yield* methods("turn/start", "thread/start")).toEqual([]);
		},
	);
}
