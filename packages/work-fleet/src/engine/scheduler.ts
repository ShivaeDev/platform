import { Effect } from "effect";
import { inBoardReadPass, withBoardReadPass } from "#board/readPass.ts";
import { schedulerPassed } from "#engine/health.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { Fleet } from "#fleet.ts";

const dispatchPrepared = Effect.gen(function* () {
	const fleet = yield* Fleet;
	const prepared = (yield* fleet.list()).filter(({ value }) => value.stage === "prepared");
	// Admission serializes capacity and quota in the store, so provider launch latency need not serialize the fan-out.
	return yield* Effect.forEach(prepared, ({ value }) => fleet.dispatch(value.workId).pipe(Effect.result), { concurrency: "unbounded" });
});
const activeWork = Effect.gen(function* () {
	const fleet = yield* Fleet;
	return (yield* fleet.list()).filter(
		({ value }) =>
			!["completed", "released", "prepared"].includes(value.stage)
			|| pendingAcknowledgements(value).length > 0
			|| pendingSessionCleanup(value).length > 0,
	);
});
export const cycle = inBoardReadPass(
	Effect.gen(function* () {
		const fleet = yield* Fleet;
		const result = yield* Effect.all(
			{
				dispatched: dispatchPrepared,
				reconciled: activeWork.pipe(
					Effect.flatMap((active) =>
						Effect.forEach(active, ({ value }) => fleet.reconcile(value.workId).pipe(Effect.result), { concurrency: "unbounded" }),
					),
				),
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
				yield* Effect.sleep(interval);
			}),
		),
	);
});
