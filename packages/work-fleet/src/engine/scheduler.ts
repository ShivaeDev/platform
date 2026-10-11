import { Effect, Result } from "effect";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { Fleet } from "#fleet.ts";

const dispatchPrepared = Effect.gen(function* () {
	const fleet = yield* Fleet;
	const prepared = (yield* fleet.list())
		.filter(({ value }) => value.stage === "prepared")
		.sort((left, right) => (right.value.launchRetry?.retryAt ?? 0) - (left.value.launchRetry?.retryAt ?? 0));
	const dispatched: Result.Result<Effect.Success<ReturnType<typeof fleet.dispatch>>, Effect.Error<ReturnType<typeof fleet.dispatch>>>[] = [];
	for (const { value } of prepared) {
		const result = yield* fleet.dispatch(value.workId).pipe(Effect.result);
		dispatched.push(result);
		if (Result.isSuccess(result) && result.success.value.launchRetry !== undefined) {
			break;
		}
	}
	return dispatched;
});
const activeWork = Effect.gen(function* () {
	const fleet = yield* Fleet;
	return (yield* fleet.list()).filter(
		({ value }) => !["completed", "released", "prepared"].includes(value.stage) || pendingAcknowledgements(value).length > 0,
	);
});
export const cycle = Effect.gen(function* () {
	const fleet = yield* Fleet;
	return yield* Effect.all(
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
});
export const run = Effect.fn("Fleet.run")(function* <R = never>(
	interval: Parameters<typeof Effect.sleep>[0],
	admit: Effect.Effect<void, never, R> = Effect.void,
) {
	const fleet = yield* Fleet;
	const running = new Set<string>();
	yield* Effect.forever(
		Effect.gen(function* () {
			yield* admit;
			for (const { value } of yield* activeWork) {
				if (running.has(value.workId)) {
					continue;
				}
				running.add(value.workId);
				yield* fleet.reconcile(value.workId).pipe(Effect.ignore, Effect.ensuring(Effect.sync(() => running.delete(value.workId))), Effect.forkScoped);
			}
			yield* dispatchPrepared;
			yield* Effect.sleep(interval);
		}),
	);
});
