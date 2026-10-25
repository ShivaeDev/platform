import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";
import { repairRecord } from "#test/repairRecord.ts";

const GUIDANCE = "Preserve the loading indicator while making the requested repair.";

for (const kind of ["review", "checks"] as const) {
	engine.it(
		`queued guidance preserves ${kind} repair instructions through restart and worker launch`,
		[humanMergeRequired()],
		function* ({ fleet, prepareWork, finishWorkers, afterRestart, replaceStoredRecord, turnOutputById }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const ready = yield* fleet.reconcile("one");

			const repairPrompt = kind === "review" ? "Fix the missing empty state found in review." : "Fix the failing database check.";
			yield* replaceStoredRecord(repairRecord(ready.value, kind, repairPrompt));
			yield* fleet.queueAnswer("one", GUIDANCE);
			const next = yield* afterRestart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
			const attempt = next.value.attempts.at(-1);
			if (attempt?.receipt === undefined) {
				return yield* Effect.die("Expected the next repair receipt");
			}
			expect(attempt.role).toBe("repair");
			expect(attempt.prompt).toBe(`${repairPrompt}\n\n${GUIDANCE}`);
			expect(attempt.receipt.sessionId).toBe(ready.value.attempts[0]?.receipt?.sessionId);
			expect(turnOutputById(attempt.receipt.turnId)).toBe(attempt.prompt);
			expect(next.value.pendingAnswers).toBeUndefined();
			if (kind === "checks") {
				expect(attempt.checkFailures).toEqual(["database"]);
			}
		},
	);
}
