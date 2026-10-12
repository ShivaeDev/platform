import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker, QUESTION } from "#test/workerQuestion.ts";

for (const repair of ["review", "checks"] as const) {
	postgresTests("test", "isolated")(`an answered ${repair} repair question retains the repair instructions on a fresh thread after restart`, () => {
		let now = 100;
		let unusableSession: string | undefined;
		let head = "initial-head";
		const rejection = new SessionFailure({ code: "session-active-turn-exhausted", message: "Thread cannot accept another turn", reason: "rejected" });
		return withFleetBoard(
			{
				checksQuery: (result) =>
					Effect.succeed({
						evidence: ["Required build check"],
						head: result.head,
						passed: repair === "review" || result.head === "repaired-head",
						repairPrompt: "Fix the failed required check",
					}),
				decorateTransport: (transport) => ({
					...transport,
					startTurn: (input) => (input.sessionId === unusableSession ? Effect.fail(rejection) : transport.startTurn(input)),
				}),
				now: () => now,
				repairs: repair === "review",
				resultQuery: () => Effect.succeed({ head, kind: "change", paths: ["src/one.ts"], pr: "https://example.invalid/pr/one" }),
			},
			(fixture, root) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					const prepared = (yield* prepareWork("one")).value;
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const repairing = (yield* fleet.reconcile("one")).value;
					expect(repairing.attempts.at(-1)?.role).toBe("repair");
					const instructions = repairing.checks?.repairPrompt ?? repairing.review?.repairPrompt;
					expect(instructions).toEqual(expect.any(String));
					const { decision } = yield* askWorker(fixture);
					const answer = yield* answerWorker(root, decision);
					unusableSession = decision.worker?.sessionId;
					const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
					expect(queued.stage).toBe("repairing");
					expect(queued.decision).toBeUndefined();
					expect(queued.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
					now = 30_100;
					yield* fixture.restart(
						Effect.gen(function* () {
							const resumed = yield* Fleet;
							const continuing = (yield* resumed.reconcile("one")).value;
							const attempt = continuing.attempts.at(-1);
							expect(continuing.stage).toBe("executing");
							expect(continuing.result).toEqual(repairing.result);
							expect(continuing.preparation).toEqual(repairing.preparation);
							expect(attempt?.receipt?.sessionId).not.toBe(unusableSession);
							expect(attempt?.role).toBe("repair");
							const prompt = fixture.starts.at(-1)?.prompt;
							expect(prompt).toContain(prepared.prompt);
							expect(prompt).toContain(instructions);
							expect(prompt).toContain(QUESTION);
							expect(prompt).toContain(answer.body);
							expect(prompt).toContain(repairing.result?.kind === "change" ? repairing.result.pr : "missing PR");
							expect(prompt).toContain("same branch");
							expect(fixture.launched).toHaveLength(3);
							yield* resumed.resolve("one", decision.id, answer.id);
							expect((yield* resumed.get("one")).value.attempts).toEqual(continuing.attempts);
							yield* resumed.reconcile("one");
							expect((yield* resumed.get("one")).value.attempts.at(-1)?.operationId).toBe(attempt?.operationId);
							expect(fixture.launched).toHaveLength(3);
							head = "repaired-head";
							finishWorkers(fixture);
							const completed = (yield* resumed.reconcile("one")).value;
							expect(completed.stage).toBe("completed");
							expect(fixture.reviews).toEqual(["initial-head", "repaired-head"]);
							expect(completed.review?.head).toBe("repaired-head");
							expect(completed.checks).toMatchObject({ head: "repaired-head", passed: true });
						}),
					);
				}),
		);
	});
}
