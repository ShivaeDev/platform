import { expect } from "@effect/vitest";
import { answers, answerWork } from "#test/answerHost.ts";

const TEXT = "Keep the review feedback in the next turn.";

for (const step of ["repairing", "working"] as const) {
	answers.it(`a text answer to a decision that moves to ${step} before publication reloads stays pending`, [answerWork(["one"])], function* (daemon) {
		yield* daemon.dispatch();
		daemon.finishWorkers();
		const waiting = yield* daemon.reconcile();
		expect(waiting.step).toBe("waiting");

		const answered = yield* daemon.answerAcrossPublication(waiting, step, { release: false, text: TEXT });

		expect(answered).toEqual({ answer: `answer pending while ${step}`, publishedWorkIds: ["one"] });
		expect((yield* daemon.get()).pendingAnswers).toEqual([TEXT]);
	});

	answers.it(`a text answer kept pending across a move to ${step} reaches the next turn once`, [answerWork(["one"])], function* (daemon) {
		yield* daemon.dispatch();
		daemon.finishWorkers();
		yield* daemon.answerAcrossPublication(yield* daemon.reconcile(), step, { release: false, text: TEXT });

		const next = yield* daemon.reconcile();

		expect({ pendingAnswers: next.pendingAnswers, prompt: next.attempts.at(-1)?.prompt }).toEqual({
			pendingAnswers: undefined,
			prompt: expect.stringContaining(TEXT),
		});
	});

	for (const [input, text, release] of [
		["an empty", "  ", false],
		["a release", TEXT, true],
	] as const) {
		answers.it(
			`${input} answer to a decision that moves to ${step} before publication reloads is refused as changed and leaves nothing pending`,
			[answerWork(["one"])],
			function* (daemon) {
				yield* daemon.dispatch();
				daemon.finishWorkers();
				const waiting = yield* daemon.reconcile();
				expect(waiting.step).toBe("waiting");

				const answered = yield* daemon.answerAcrossPublication(waiting, step, { release, text });

				expect(answered).toEqual({ answer: `conflict: Decision changed: ${step}`, publishedWorkIds: ["one"] });
				expect((yield* daemon.get()).pendingAnswers).toBeUndefined();
			},
		);
	}
}
