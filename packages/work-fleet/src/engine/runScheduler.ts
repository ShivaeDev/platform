import { Effect } from "effect";
import { each } from "@shivaedev/reconciler/each.ts";
import { run as reconcile } from "@shivaedev/reconciler/run.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { schedulerPassed } from "#engine/health.ts";
import { activeRecords, dispatchRecords } from "#engine/scheduler.ts";
import { type ObservationCadence, recordDue, retryDue } from "#engine/schedulerDue.ts";
import { Fleet } from "#fleet.ts";
import { fleetScheduling } from "#fleetRecords.ts";
import { schedulerInputs } from "#schedulerInputs.ts";
import { openSweep } from "#scheduling/sweeps.ts";

export const startScheduler = Effect.fn("Fleet.startScheduler")(function* <R = never, TCadence = never>(
	cadence: Effect.Effect<ObservationCadence, never, TCadence>,
	admit: Effect.Effect<void, never, R> = Effect.void,
) {
	const fleet = yield* Fleet;
	const keys = [fleetScheduling.list, schedulerInputs.list];
	const records = yield* each({
		act: ({ value }) =>
			Effect.gen(function* () {
				const worker = yield* reconcile({
					act: () => withBoardReadPass(fleet.reconcile(value.workId)).pipe(Effect.ignore),
					due: ({ record, cadence: current }, now) => recordDue(record.value, current, now),
					keys,
					read: Effect.all({ cadence, record: fleet.get(value.workId) }),
				});
				yield* worker.await;
			}),
		key: ({ value }) => value.workId,
		keys,
		read: fleet.list().pipe(Effect.map((rows) => activeRecords(rows).filter(({ value }) => !openSweep(value)))),
	});
	const admission = yield* reconcile({
		act: () =>
			withBoardReadPass(
				Effect.gen(function* () {
					yield* admit;
					const current = yield* fleet.list();
					for (const { value } of activeRecords(current).filter((entry) => openSweep(entry.value))) {
						yield* fleet.reconcile(value.workId).pipe(Effect.ignore);
					}
					yield* dispatchRecords(current);
					yield* schedulerPassed;
				}),
			),
		due: ({ records: current, cadence: interval }, now) =>
			Math.min(
				now + interval.github,
				...current.flatMap(({ value }) => (openSweep(value) ? recordDue(value, interval, now) : retryDue(value, now)) ?? []),
			),
		keys,
		read: Effect.all({ cadence, records: fleet.list() }),
	});
	return { admission, records };
});

export const run = Effect.fn("Fleet.run")(function* <R = never, TCadence = never>(
	cadence: Effect.Effect<ObservationCadence, never, TCadence>,
	admit: Effect.Effect<void, never, R> = Effect.void,
) {
	const workers = yield* startScheduler(cadence, admit);
	yield* Effect.all([workers.records.await, workers.admission.await], { concurrency: "unbounded" });
});
