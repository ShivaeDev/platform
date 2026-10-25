import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { stalledInterruptIsObserved } from "#test/engineStalledTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { replacementDecision } from "#test/replacementDecision.ts";

for (const scenario of [
	{ action: "retry", replaceDecision: false },
	{ action: "release", replaceDecision: false },
	{ action: "retry", replaceDecision: true },
	{ action: "release", replaceDecision: true },
] as const) {
	const { action, replaceDecision } = scenario;

	engine.it(
		`stalled ${action} fences late output, replacement=${replaceDecision}`,
		[stalledInterruptIsObserved()],
		function* ({
			providerInterruptions,
			advanceTime,
			currentTime,
			fleet,
			prepareWork,
			afterRestart,
			respond,
			providerStarts,
			replaceStoredRecord,
			setTurnExecution,
			acknowledgeProviderTurn,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			for (let pass = 0; pass < 3; pass += 1) {
				advanceTime(31 * 60_000);
				yield* fleet.reconcile("one");
			}
			const stalled = yield* fleet.get("one");
			expect(stalled.value.decision?.code).toBe("session-stalled");
			yield* replaceStoredRecord({ ...stalled.value, decision: replacementDecision(stalled.value.decision, replaceDecision) });
			const attempt = stalled.value.attempts[0];
			const receipt = attempt?.receipt;
			if (attempt === undefined || receipt === undefined) {
				return yield* Effect.die("Missing stalled attempt");
			}
			const decisionId = stalled.value.decision?.id ?? "missing";
			const responseId = respond(decisionId, action);
			const resolved = yield* afterRestart(fleet.resolve("one", decisionId, responseId));
			expect(resolved.value.step).toBe(action === "retry" ? "queued" : "released");
			expect(resolved.value.attempts[0]).toMatchObject({
				abandoned: { at: currentTime(), observation: { execution: "running", output: attempt.output, receipt } },
				sessionUnusable: true,
				status: "failed",
			});
			expect(providerInterruptions()).toEqual([receipt.turnId, receipt.turnId]);
			expect((yield* acknowledgeProviderTurn(attempt.operationId, receipt).pipe(Effect.result))._tag).toBe("Failure");
			setTurnExecution(receipt, "completed", "Late abandoned output");
			if (action === "retry") {
				const fresh = yield* afterRestart(fleet.dispatch("one"));
				expect(fresh.value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2"]);
				expect(fresh.value.attempts[1]?.receipt?.sessionId).not.toBe(receipt.sessionId);
				expect(fresh.value.attempts[1]?.receipt?.turnId).not.toBe(receipt.turnId);
				expect(providerStarts().map((start) => start.operationId)).toEqual(["operation-1", "operation-2"]);
			} else {
				const other = yield* prepareWork("two");
				expect((yield* fleet.dispatch(other.value.workId)).value.step).toBe("working");
			}
			const afterLateOutput = yield* afterRestart(fleet.reconcile("one"));
			expect(afterLateOutput.value.attempts[0]?.output).toBeUndefined();
			expect(afterLateOutput.value.result).toBeUndefined();
			expect((yield* fleet.resolve("one", decisionId, responseId)).value.attempts).toEqual(afterLateOutput.value.attempts);
		},
	);
}
