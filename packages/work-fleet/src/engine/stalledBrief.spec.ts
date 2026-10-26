import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { stalledWorker } from "#test/engineStalledTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const action of ["retry", "dispatch", "release"] as const) {
	engine.it(
		`an edited brief preserves stalled recovery across restart and ${action}`,
		[markdownWork(), stalledWorker()],
		function* ({
			answerReportDecision,
			providerSteers,
			advanceTime,
			currentTime,
			fleet,
			prepareWork,
			afterRestart,
			providerStarts,
			setTurnExecution,
			source,
			acknowledgeProviderTurn,
			writeBoardWork,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			advanceTime(31 * 60_000);
			const stalled = yield* fleet.reconcile("one");
			expect(stalled.value.decision?.code).toBe("session-stalled");
			const attempt = stalled.value.attempts.at(-1);
			const receipt = attempt?.receipt;
			if (attempt === undefined || receipt === undefined) {
				return yield* Effect.die("Missing stalled receipt");
			}
			const current = `${source}\nRevised acceptance criteria.\n`;
			writeBoardWork("one.md", current);
			const changed = yield* afterRestart(fleet.reconcile("one"));
			const decision = changed.value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing context decision");
			}
			expect(decision.reason).toBe("Board context changed");
			const resolved = yield* afterRestart(
				action === "dispatch" ? fleet.dispatch("one") : fleet.resolve("one", decision.id, answerReportDecision(decision.published, action)),
			);
			expect(resolved.value.attempts.at(action === "dispatch" ? -2 : -1)).toMatchObject({
				abandoned: { at: currentTime() },
				sessionUnusable: true,
				status: "failed",
			});
			expect((yield* acknowledgeProviderTurn(attempt.operationId, receipt).pipe(Effect.result))._tag).toBe("Failure");
			setTurnExecution(receipt, "completed", "Late abandoned output");
			if (action === "release") {
				expect(resolved.value.step).toBe("released");
			} else {
				const fresh = action === "dispatch" ? resolved : yield* afterRestart(fleet.dispatch("one"));
				expect(fresh.value.boardContext).toBe(current);
				expect(fresh.value.attempts).toHaveLength(stalled.value.attempts.length + 1);
				expect(fresh.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(receipt.sessionId);
				expect(fresh.value.attempts.at(-1)?.receipt?.turnId).not.toBe(receipt.turnId);
				expect(providerStarts().map((start) => start.operationId)).toEqual(["operation-1", "operation-2"]);
				expect(providerSteers()).toEqual([]);
			}
			const observed = yield* afterRestart(fleet.reconcile("one"));
			const abandoned = observed.value.attempts.find((entry) => entry.operationId === attempt.operationId);
			expect(abandoned).toBeDefined();
			expect(abandoned?.output).toBeUndefined();
			expect(abandoned?.abandoned).toEqual(resolved.value.attempts.find((entry) => entry.operationId === attempt.operationId)?.abandoned);
			expect(observed.value.result).toBeUndefined();
		},
	);
}
