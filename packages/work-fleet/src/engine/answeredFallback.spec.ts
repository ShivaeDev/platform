import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker, QUESTION } from "#test/workerQuestion.ts";

postgresTests("test", "isolated")("a definitively wedged question thread continues with its answer and existing PR after restart", () => {
	let unusableSession: string | undefined;
	const rejection = new SessionFailure({ code: "session-active-turn-exhausted", message: "Thread cannot accept another turn", reason: "rejected" });
	return withFleetBoard(
		{
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) => (input.sessionId === unusableSession ? Effect.fail(rejection) : transport.startTurn(input)),
			}),
		},
		(fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const { decision, stopped } = yield* askWorker(fixture);
				const result = {
					head: "existing-head",
					kind: "change" as const,
					paths: ["src/one.ts"],
					pr: "https://github.com/example/repository/pull/1",
				};
				yield* fixture.replaceRecord({ ...stopped.value, result });
				const answer = yield* answerWorker(root, decision);
				unusableSession = decision.worker?.sessionId;
				const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
				expect(queued.stage).toBe("repairing");
				expect(queued.decision).toBeUndefined();
				expect(queued.attempts.at(-1)).toMatchObject({ sessionUnusable: true, status: "failed" });
				expect(queued.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
				const resumed = (yield* fixture.restart(fleet.reconcile("one"))).value;
				expect(resumed.stage).toBe("executing");
				expect(resumed.result).toEqual(result);
				expect(resumed.preparation).toEqual(stopped.value.preparation);
				expect(resumed.attempts.at(-1)?.receipt?.sessionId).not.toBe(unusableSession);
				expect(fixture.starts.at(-1)?.prompt).toContain(stopped.value.prompt);
				expect(fixture.starts.at(-1)?.prompt).toContain(QUESTION);
				expect(fixture.starts.at(-1)?.prompt).toContain(answer.body);
				expect(fixture.starts.at(-1)?.prompt).toContain(result.pr);
				expect(fixture.starts.at(-1)?.prompt).toContain("same branch");
				expect(fixture.launched).toHaveLength(2);
				yield* fleet.resolve("one", decision.id, answer.id);
				expect((yield* fleet.get("one")).value.attempts).toEqual(resumed.attempts);
			}),
	);
});

for (const reason of ["rejected", "ambiguous", "unavailable"] as const) {
	postgresTests("test")(`a ${reason} submission without definite exhaustion retains the answer without starting another thread`, () => {
		let fail = false;
		const failure = new SessionFailure({ code: "session-rejected", message: "Continuation failed", reason });
		return withFleetBoard(
			{
				submissionFailure: (call) => (fail && call === "turn" ? failure : undefined),
			},
			(fixture, root) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					const { decision } = yield* askWorker(fixture);
					const answer = yield* answerWorker(root, decision);
					fail = true;
					yield* fleet.resolve("one", decision.id, answer.id);
					const blocked = (yield* fixture.restart(fleet.reconcile("one"))).value;
					expect(blocked.stage).toBe("needs-human");
					expect(blocked.attempts).toHaveLength(2);
					expect(blocked.attempts.at(-1)?.sessionUnusable).toBeUndefined();
					expect(blocked.responses).toMatchObject([{ responseId: answer.id }]);
					expect(fixture.launched).toHaveLength(1);
				}),
		);
	});
}
