import { expect } from "@effect/vitest";
import { answers, answerWork } from "#test/answerHost.ts";

const TEXT = "Keep the review feedback in the next turn.";

for (const step of ["repairing", "working"] as const) {
	for (const input of ["text", "empty", "release"] as const) {
		answers.it(`answer ${input} handles a move to ${step} before decision publication reloads`, [answerWork(["one"])], function* (daemon) {
			yield* daemon.dispatch();
			daemon.finishWorkers();
			const waiting = yield* daemon.reconcile();
			expect(waiting.step).toBe("waiting");
			const { publishedWorkIds, result } = yield* daemon.answerAcrossPublication(waiting, step, {
				release: input === "release",
				text: input === "empty" ? "  " : TEXT,
			});
			expect(publishedWorkIds).toEqual(["one"]);
			const current = yield* daemon.get();
			if (input !== "text") {
				expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "Conflict", message: `Decision changed: ${step}` } });
				expect(current.pendingAnswers).toBeUndefined();
				return;
			}
			expect(result).toMatchObject({ _tag: "Success", success: { value: { pendingAnswers: [TEXT], step } } });
			expect(current.pendingAnswers).toEqual([TEXT]);
			const next = yield* daemon.reconcile();
			expect(next.attempts.at(-1)?.prompt).toContain(TEXT);
			expect(next.pendingAnswers).toBeUndefined();
		});
	}
}
