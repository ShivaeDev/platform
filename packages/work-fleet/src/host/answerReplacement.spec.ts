import { expect } from "@effect/vitest";
import { answers, answerWork } from "#test/answerHost.ts";
import { outcomeOf, refusal } from "#test/refusal.ts";
import { replacementRace } from "#test/replacementRace.ts";

const CHANGED = "conflict: Decision changed: Current observation needs another inspection";
const TEXT = "Retain the existing review feedback.";

for (const window of ["after-record", "during-record", "during-resolve"] as const) {
	answers.it(
		`an answer whose Board question is replaced by the same kind ${window} applies to the replacement and closes it`,
		[answerWork(["one"]), replacementRace(window)],
		function* (daemon) {
			yield* daemon.dispatch();
			daemon.finishWorkers();
			const waiting = yield* daemon.reconcile();
			daemon.replaceDecisionOnRead(waiting, "same-kind");

			const answered = yield* outcomeOf(
				daemon.answerAndWait(TEXT),
				({ responses }) => responses?.map(({ decisionId }) => `answered ${decisionId}`).join(", ") ?? "",
			);

			expect(answered).toBe(`answered ${waiting.decision?.id}.replacement`);
			const current = yield* daemon.get();
			expect({ decision: current.decision, responses: current.responses }).toMatchObject({
				decision: undefined,
				responses: [{ action: "retry", boardAcknowledged: true }],
			});
		},
	);
}

for (const replacement of ["different-kind", "left-needs-human"] as const) {
	answers.it(
		`an answer whose Board question is replaced by a ${replacement} decision is refused as changed and records no response`,
		[answerWork(["one"]), replacementRace("after-record")],
		function* (daemon) {
			yield* daemon.dispatch();
			daemon.finishWorkers();
			daemon.replaceDecisionOnRead(yield* daemon.reconcile(), replacement);

			const answered = yield* refusal(daemon.answerAndWait(TEXT));

			expect(answered).toBe(CHANGED);
			expect((yield* daemon.get()).responses ?? []).toEqual([]);
		},
	);
}

answers.it(
	"after a refused answer, releasing the different-kind replacement releases the work",
	[answerWork(["one"]), replacementRace("after-record")],
	function* (daemon) {
		yield* daemon.dispatch();
		daemon.finishWorkers();
		daemon.replaceDecisionOnRead(yield* daemon.reconcile(), "different-kind");
		expect(yield* refusal(daemon.answerAndWait(TEXT))).toBe(CHANGED);

		const released = yield* daemon.answerAndWait("", true);

		expect(released.step).toBe("released");
	},
);

answers.it(
	"an answer whose Board question is replaced by a repair queues for the repair turn",
	[answerWork(["one"]), replacementRace("after-record")],
	function* (daemon) {
		yield* daemon.dispatch();
		daemon.finishWorkers();
		daemon.replaceDecisionOnRead(yield* daemon.reconcile(), "repairing");

		const answered = yield* daemon.answerAndWait(TEXT);

		expect(answered).toMatchObject({ pendingAnswers: [TEXT], step: "repairing" });
	},
);
