import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { duplicateTerminalTurns } from "#test/duplicateTerminalTurns.ts";
import { engine } from "#test/engineStory.ts";

const REASON = "Multiple Codex turns match one operation; retain reservation";

for (const fault of ["none", "running", "unavailable", "mismatch", "wrong-session", "acknowledged"] as const) {
	{
		const setup = duplicateTerminalTurns(fault);
		engine.it(
			`duplicate completed turns persist every paginated receipt and release with ${fault} evidence after restart`,
			[setup.given],
			function* ({ fixture, fleet, prepareWork, restart, respond }) {
				const context = setup.context();
				yield* prepareWork("one");

				yield* fleet.dispatch("one");
				const stopped = yield* fleet.reconcile("one");
				expect(stopped.value.decision?.reason).toBe(REASON);
				expect(stopped.value.attempts[0]?.terminalReceipts).toEqual(context.receipts);
				if (fault === "wrong-session") {
					yield* fixture.replaceRecord({
						...stopped.value,
						attempts: stopped.value.attempts.map((attempt) => ({
							...attempt,
							terminalReceipts: [...context.receipts.slice(0, 2), { sessionId: "other-session", turnId: "third" }],
						})),
					});
				}
				const decisionId = stopped.value.decision?.id ?? "missing";
				if (fault === "acknowledged") {
					yield* fixture.acknowledgeTurn("operation-1", { sessionId: "session-operation-1", turnId: "third" });
				}
				const retryId = respond(decisionId, "retry");
				expect((yield* fleet.resolve("one", decisionId, retryId).pipe(Effect.result))._tag).toBe("Failure");
				const responseId = respond(decisionId, "release");
				const resolve = Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decisionId, responseId)));
				if (fault !== "none" && fault !== "acknowledged") {
					expect((yield* restart(resolve.pipe(Effect.result)))._tag).toBe("Failure");
					expect((yield* fleet.get("one")).value.stage).toBe("needs-human");
					const pending = yield* fleet.get("one");
					yield* fixture.replaceRecord({
						...pending.value,
						attempts: pending.value.attempts.map((attempt) => ({ ...attempt, terminalReceipts: context.receipts })),
					});
				}
				context.restored = true;
				context.native.states.set("third", "completed");
				const released = yield* restart(resolve);
				expect(released.value.stage).toBe("released");
				expect(released.value.attempts[0]?.terminalReceipts).toEqual(context.receipts);
				expect(released.value.attempts[0]?.receipt?.turnId).toBe(fault === "acknowledged" ? "third" : undefined);
				expect(fixture.settings.filter((setting) => setting.call === "turn")).toHaveLength(1);
				expect((yield* restart(resolve)).value.responses).toEqual(released.value.responses);
			},
		);
	}
}
