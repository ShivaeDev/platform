import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { changeRecoveryWork, finishRecoveryWorker, launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryScopeCases(): readonly RecoveryCase[] {
	let context: RecoveryContext | undefined;
	let changeReview = false;
	function changeDuringReview(output: string) {
		return Effect.sync(() => {
			if (changeReview && output.startsWith("FLEET_REVIEW:") && context !== undefined) {
				changeRecoveryWork(context);
			}
		});
	}

	return [
		{
			enter: Effect.fnUntraced(function* (ctx) {
				yield* prepareWork("one");
				changeRecoveryWork(ctx);
				yield* (yield* Fleet).dispatch("one");
			}),
			name: "scope changed before dispatch",
			reason: "Board context changed after preparation",
			sites: ['engine/dispatchCommand.ts: "Board context changed after preparation"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				changeRecoveryWork(ctx);
				setLastObservation(ctx, { execution: "completed", output: REPORT });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "scope changed during execution",
			reason: "Board context changed while work ran",
			sites: ['engine/makeAdopt.ts: "Board context changed while work ran"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryWorker(ctx);
				changeRecoveryWork(ctx);
				finishWorkers(ctx.fixture);
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "scope changed before review",
			reason: "Board context changed during review",
			sites: ['engine/makeReview.ts: "Board context changed during review"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryWorker(ctx);
				changeReview = true;
				finishWorkers(ctx.fixture);
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "scope changed during review",
			options: {
				decorateTransport: (transport) => ({
					...transport,
					observe: (receipt) => transport.observe(receipt).pipe(Effect.tap((observation) => changeDuringReview(observation.output))),
				}),
			},
			reason: "Board context changed during review",
			sites: ['engine/refreshReviewResult.ts: "Board context changed during review"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryWorker(ctx);
				finishWorkers(ctx.fixture);
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "scope changed before repair launch",
			options: {
				checksQuery: (result) =>
					Effect.sync(() => {
						if (context !== undefined) {
							changeRecoveryWork(context);
						}
						return { evidence: ["Failed check"], head: result.head, passed: false, repairPrompt: "Repair" };
					}),
			},
			reason: "Board context changed after preparation",
			sites: ['engine/makeLaunch.ts: "Board context changed after preparation"'],
		},
	];
}
