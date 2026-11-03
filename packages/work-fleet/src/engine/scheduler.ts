import { Cause, Effect, Result } from "effect";
import { inBoardReadPass } from "#board/readPass.ts";
import { boardCompletionAction } from "#engine/completeBoardWork.ts";
import { expectedDispatchWait } from "#engine/expectedDispatchWait.ts";
import { schedulerPassed } from "#engine/health.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { needsReleasedDelivery } from "#engine/releasedDeliveries.ts";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { needsReleasedSettlement } from "#engine/settleReleasedWork.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { openSweep } from "#scheduling/sweeps.ts";
import type { Versioned } from "#storage/model.ts";

export const dispatchRecords = Effect.fn("Fleet.dispatchRecords")(function* (records: readonly Versioned<FleetRecord>[]) {
	const fleet = yield* Fleet;
	const prepared = yield* fleet.admissionOrder(records);
	const previous = new Map(prepared.map(({ value }) => [value.workId, value]));
	const dispatched: Result.Result<Effect.Success<ReturnType<typeof fleet.dispatch>>, Effect.Error<ReturnType<typeof fleet.dispatch>>>[] = [];
	for (const { value } of prepared) {
		const result = yield* fleet.dispatch(value.workId).pipe(Effect.result);
		dispatched.push(result);
		if (Result.isFailure(result) && !expectedDispatchWait(result.failure)) {
			yield* Effect.logWarning("Fleet dispatch failed", Cause.fail(result.failure)).pipe(Effect.annotateLogs({ workId: value.workId }));
		}
		if (
			(Result.isSuccess(result) && result.success.value.launchRetry !== undefined)
			|| ((yield* fleet.hasLaunchRetry())
				&& (yield* fleet.list()).some(({ value: current }) => {
					const before = previous.get(current.workId);
					return (
						current.launchRetry !== undefined
						&& (before?.launchRetry?.rejections !== current.launchRetry.rejections
							|| before?.attempts.at(-1)?.operationId !== current.attempts.at(-1)?.operationId)
					);
				}))
		) {
			break;
		}
	}
	return dispatched;
});

export function activeRecords(records: readonly Versioned<FleetRecord>[]) {
	return records
		.filter(
			({ value }) =>
				value.pendingContinuation !== undefined
				|| !["done", "released", "queued"].includes(value.step)
				|| needsReleasedDelivery(value)
				|| needsReleasedSettlement(value)
				|| boardCompletionAction(value) !== undefined
				|| pendingAcknowledgements(value).length > 0
				|| pendingSessionCleanup(value).length > 0,
		)
		.toSorted((left, right) => Number(openSweep(right.value)) - Number(openSweep(left.value)));
}

const reconcileRecords = Effect.fn("Fleet.reconcileRecords")(function* (records: readonly Versioned<FleetRecord>[]) {
	const fleet = yield* Fleet;
	function reconcile(continuing: boolean) {
		return Effect.forEach(
			records.filter(({ value }) => (value.pendingContinuation !== undefined) === continuing),
			({ value }) => fleet.reconcile(value.workId).pipe(Effect.result),
			{ concurrency: "unbounded" },
		);
	}
	const progressed = yield* reconcile(false);
	const continued = yield* reconcile(true);
	return [...progressed, ...continued];
});

export const cycle = inBoardReadPass(
	Effect.gen(function* () {
		const fleet = yield* Fleet;
		const records = yield* fleet.list();
		const active = activeRecords(records).filter(({ value }) => value.step !== "queued" || needsReleasedDelivery(value));
		const sweeps = yield* Effect.forEach(
			active.filter(({ value }) => openSweep(value)),
			({ value }) => fleet.reconcile(value.workId).pipe(Effect.result),
		);
		const result = yield* Effect.all(
			{
				dispatched: dispatchRecords(records),
				reconciled: reconcileRecords(active.filter(({ value }) => !openSweep(value))),
			},
			{ concurrency: "unbounded" },
		);
		yield* schedulerPassed;
		return { ...result, reconciled: [...sweeps, ...result.reconciled] };
	}),
);
