import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryUncertainCases(): readonly RecoveryCase[] {
	let restored = false;
	return [
		{
			code: "session-ambiguous" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				setLastObservation(ctx, { execution: "completed", output: REPORT });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "observation receipt mismatch",
			options: {
				decorateTransport: (transport) => ({
					...transport,
					observe: (receipt) =>
						transport
							.observe(receipt)
							.pipe(Effect.map((observation) => (restored ? observation : { ...observation, receipt: { ...receipt, turnId: "different" } }))),
				}),
			},
			recovery: "adopt-matching-receipt",
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "session-unavailable" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				setLastObservation(ctx, { execution: "completed", output: REPORT });
				const record = yield* (yield* Fleet).get("one");
				const receipt = record.value.attempts.at(-1)?.receipt;
				if (receipt === undefined) {
					return yield* Effect.die("Missing receipt");
				}
				ctx.fixture.failedObservations.add(receipt.turnId);
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "terminal observation unavailable",
			recovery: "adopt-observed-worker",
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "session-ambiguous" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				setLastObservation(ctx, { execution: "completed", output: REPORT });
				const stored = yield* (yield* Fleet).get("one");
				ctx.fixture.operations.clear();
				yield* ctx.fixture.replaceRecord({
					...stored.value,
					attempts: stored.value.attempts.map((attempt) => ({ ...attempt, receipt: undefined, status: "submitting" })),
				});
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "receipt temporarily unavailable",
			recovery: "recover-authoritative-receipt",
			restore: (ctx) =>
				Effect.sync(() => {
					const observed = [...ctx.fixture.observations.values()][0];
					const operation = ctx.fixture.launched[0];
					if (observed === undefined || operation === undefined) {
						throw new Error("Missing authoritative observation");
					}
					ctx.fixture.operations.set(operation, observed.receipt);
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
