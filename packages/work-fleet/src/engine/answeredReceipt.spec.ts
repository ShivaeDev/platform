import { expect } from "@effect/vitest";
import { Deferred, Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

postgresTests("live", "isolated")("observes the persisted answer receipt when it lands during the advance pass Board read", function* () {
	const gate = yield* Deferred.make<void>();
	let betweenLaunchAndObserve = Effect.void;
	let recoveries = 0;
	yield* withFleetBoard(
		{
			continuationGate: Deferred.await(gate),
			decorateBoard: (board) => ({ ...board, get: (id) => board.get(id).pipe(Effect.tap(() => betweenLaunchAndObserve)) }),
			decorateTransport: (transport) => ({
				...transport,
				reconcile: () => {
					recoveries += 1;
					return Effect.fail(
						new SessionFailure({ message: "No matching accepted turn is observable; absence does not authorize replay", reason: "ambiguous" }),
					);
				},
			}),
		},
		(fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const { decision } = yield* askWorker(fixture);
				const answer = yield* answerWorker(root, decision);
				betweenLaunchAndObserve = Effect.gen(function* () {
					const pending = (yield* fleet.get("one")).value.attempts.at(-1);
					if (pending?.status !== "submitting") {
						return;
					}
					betweenLaunchAndObserve = Effect.void;
					expect(pending.receipt).toBeUndefined();
					yield* Deferred.succeed(gate, undefined);
					while ((yield* fleet.get("one")).value.attempts.at(-1)?.receipt === undefined) {
						yield* Effect.yieldNow;
					}
					yield* Effect.yieldNow;
				}).pipe(Effect.orDie);
				const continued = (yield* fleet.reconcile("one").pipe(Effect.timeout("5 seconds"))).value;
				expect(continued.step).toBe("working");
				expect(continued.decision).toBeUndefined();
				expect(continued.attempts.at(-1)).toMatchObject({
					prompt: answer.body,
					receipt: { sessionId: decision.worker?.sessionId },
					status: "running",
				});
				expect(recoveries).toBe(0);
				expect(fixture.launched).toHaveLength(1);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
				yield* fixture.restart(fleet.reconcile("one"));
				expect(recoveries).toBe(0);
			}),
	);
});
