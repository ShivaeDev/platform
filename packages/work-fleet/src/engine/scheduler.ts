import { Effect, Result } from "effect";
import { inBoardReadPass, withBoardReadPass } from "#board/readPass.ts";
import { schedulerPassed } from "#engine/health.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

const dispatchRecords = Effect.fn("Fleet.dispatchRecords")(function* (records: readonly Versioned<FleetRecord>[]) {
	const fleet = yield* Fleet;
	const prepared = records
		.filter(({ value }) => value.stage === "prepared")
		.sort((left, right) => (right.value.launchRetry?.retryAt ?? 0) - (left.value.launchRetry?.retryAt ?? 0));
	const dispatched: Result.Result<Effect.Success<ReturnType<typeof fleet.dispatch>>, Effect.Error<ReturnType<typeof fleet.dispatch>>>[] = [];
	for (const { value } of prepared) {
		const result = yield* fleet.dispatch(value.workId).pipe(Effect.result);
		dispatched.push(result);
		if (
			(Result.isSuccess(result) && result.success.value.launchRetry !== undefined)
			|| (yield* fleet.list()).some(({ value: current }) => current.launchRetry !== undefined)
		) {
			break;
		}
	}
	return dispatched;
});

function activeRecords(records: readonly Versioned<FleetRecord>[]) {
	return records.filter(
		({ value }) =>
			!["completed", "released", "prepared"].includes(value.stage)
			|| pendingAcknowledgements(value).length > 0
			|| pendingSessionCleanup(value).length > 0,
	);
}

const dispatchPrepared = Effect.gen(function* () {
	const fleet = yield* Fleet;
	return yield* dispatchRecords(yield* fleet.list());
});
const activeWork = Effect.gen(function* () {
	const fleet = yield* Fleet;
	return activeRecords(yield* fleet.list());
});
export const cycle = inBoardReadPass(
	Effect.gen(function* () {
		const fleet = yield* Fleet;
		const records = yield* fleet.list();
		const active = activeRecords(records).filter(({ value }) => value.stage !== "prepared");
		const result = yield* Effect.all(
			{
				dispatched: dispatchRecords(records),
				reconciled: Effect.forEach(active, ({ value }) => fleet.reconcile(value.workId).pipe(Effect.result), {
					concurrency: "unbounded",
				}),
			},
			{ concurrency: "unbounded" },
		);
		yield* schedulerPassed;
		return result;
	}),
);
export const run = Effect.fn("Fleet.run")(function* <R = never>(
	interval: Parameters<typeof Effect.sleep>[0],
	admit: Effect.Effect<void, never, R> = Effect.void,
) {
	const fleet = yield* Fleet;
	const running = new Set<string>();
	yield* Effect.forever(
		withBoardReadPass(
			Effect.gen(function* () {
				yield* admit;
				for (const { value } of yield* activeWork) {
					if (running.has(value.workId)) {
						continue;
					}
					running.add(value.workId);
					yield* fleet
						.reconcile(value.workId)
						.pipe(Effect.ignore, Effect.ensuring(Effect.sync(() => running.delete(value.workId))), Effect.forkScoped);
				}
				yield* dispatchPrepared;
				yield* schedulerPassed;
			}),
		).pipe(Effect.andThen(Effect.sleep(interval))),
	);
});
