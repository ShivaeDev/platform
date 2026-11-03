import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { engine } from "#test/engineStory.ts";
import { duplicateTerminalTurns } from "#test/engineTurnTraits.ts";
import { refusal } from "#test/refusal.ts";

const REASON = "Multiple Codex turns match one operation; retain reservation";
for (const fault of ["none", "running", "unavailable", "mismatch", "wrong-session", "acknowledged"] as const) {
	engine.it(
		`duplicate done turns persist every paginated receipt and release with ${fault} evidence after restart`,
		[duplicateTerminalTurns(fault)],
		function* ({
			fleet,
			prepareWork,
			restart,
			respond,
			terminalReceipts,
			replaceStoredRecord,
			acknowledgeProviderTurn,
			restoreTerminalEvidence,
			providerCalls,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const stopped = yield* fleet.reconcile("one");
			expect(stopped.value.decision?.reason).toBe(REASON);
			expect(stopped.value.attempts[0]?.terminalReceipts).toEqual(terminalReceipts());
			if (fault === "wrong-session") {
				yield* replaceStoredRecord({
					...stopped.value,
					attempts: stopped.value.attempts.map((attempt) => ({
						...attempt,
						terminalReceipts: [...terminalReceipts().slice(0, 2), { sessionId: "other-session", turnId: "third" }],
					})),
				});
			}
			const decisionId = stopped.value.decision?.id ?? "missing";
			if (fault === "acknowledged") {
				yield* acknowledgeProviderTurn("operation-1", { sessionId: "session-operation-1", turnId: "third" });
			}
			const beforeRetry = yield* fleet.get("one");
			const retryId = respond(decisionId, "retry");
			const retry = yield* refusal(fleet.resolve("one", decisionId, retryId));

			yield* outcomes([
				["retry", () => Effect.succeed(retry), "bad request: This decision only permits release; choose release to stop and hand back"],
				["execution record", () => fleet.get("one"), beforeRetry],
			]);
			const responseId = respond(decisionId, "release");
			const release = fleet.resolve("one", decisionId, responseId);
			if (fault !== "none" && fault !== "acknowledged") {
				yield* restart();
				const resultResultOutcome = yield* refusal(release);
				const refusals = {
					mismatch: "unavailable: Provider receipt differs from the persisted session or turn; retain reservation",
					running: "forbidden: Confirm terminal execution before releasing ownership",
					unavailable: "unavailable: Thread evidence is unavailable",
					"wrong-session": "unavailable: Provider receipt differs from the persisted session or turn; retain reservation",
				};
				expect(resultResultOutcome).toBe(refusals[fault]);
				expect((yield* fleet.get("one")).value.step).toBe("waiting");
				const pending = yield* fleet.get("one");
				yield* replaceStoredRecord({
					...pending.value,
					attempts: pending.value.attempts.map((attempt) => ({ ...attempt, terminalReceipts: terminalReceipts() })),
				});
			}
			restoreTerminalEvidence("third");
			yield* restart();
			const released = yield* release;
			expect(released.value.step).toBe("released");
			expect(released.value.attempts[0]?.terminalReceipts).toEqual(terminalReceipts());
			expect(released.value.attempts[0]?.receipt?.turnId).toBe(fault === "acknowledged" ? "third" : undefined);
			expect(
				providerCalls()
					.filter((setting) => setting.call === "turn")
					.map((call) => call.operationId),
			).toEqual(["operation-1"]);
			yield* restart();
			expect((yield* release).value.responses).toEqual(released.value.responses);
		},
	);
}
