import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { answers, answerWork } from "#test/answerHost.ts";
import { replacementRace } from "#test/replacementRace.ts";

const REASON = "Current observation needs another inspection";
const TEXT = "Retain the existing review feedback.";

for (const [replacement, window] of [
	["same-kind", "after-record"],
	["different-kind", "after-record"],
	["left-needs-human", "after-record"],
	["repairing", "after-record"],
	["same-kind", "during-record"],
	["same-kind", "during-resolve"],
] as const) {
	answers.it(
		`answer follows a ${replacement} replacement ${window} when the Board question becomes stale`,
		[answerWork(["one"]), replacementRace(window)],
		function* (daemon) {
			yield* daemon.dispatch();
			daemon.finishWorkers();
			const waiting = yield* daemon.reconcile();
			const decision = waiting.decision;
			if (decision?.published === undefined) {
				throw new Error("Expected an open decision");
			}
			daemon.replaceDecisionOnRead(waiting, replacement);
			const result = yield* daemon.answerAndWait(TEXT).pipe(Effect.result);
			const current = yield* daemon.get();
			if (replacement === "different-kind" || replacement === "left-needs-human") {
				expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "Conflict", message: `Decision changed: ${REASON}` } });
				expect(current.responses ?? []).toHaveLength(0);
			} else if (replacement === "repairing") {
				expect(result).toMatchObject({ _tag: "Success", success: { pendingAnswers: [TEXT], step: "repairing" } });
			} else {
				expect(result).toMatchObject({
					_tag: "Success",
					success: { responses: [{ action: "retry", boardAcknowledged: true, decisionId: `${decision.id}.replacement` }] },
				});
				expect(current.decision).toBeUndefined();
			}
			if (replacement === "different-kind") {
				expect((yield* daemon.answerAndWait("", true)).step).toBe("released");
			}
		},
	);
}
