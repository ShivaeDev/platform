import { Deferred, Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";

export const schedulerSnapshot = Effect.fnUntraced(function* (fleet: typeof Fleet.Service) {
	const dispatched = yield* Deferred.make<void>();
	const reconciled: string[] = [];
	let reads = 0;
	const list = Effect.gen(function* () {
		reads += 1;
		if (reads > 1) {
			yield* Deferred.await(dispatched);
		}
		return yield* fleet.list();
	});
	const concurrent = Fleet.of({
		...fleet,
		dispatch: (id) => fleet.dispatch(id).pipe(Effect.tap(() => Deferred.succeed(dispatched, undefined))),
		list: () => list,
		reconcile: (id) => Effect.sync(() => reconciled.push(id)).pipe(Effect.andThen(fleet.reconcile(id))),
	});
	yield* cycle.pipe(Effect.provideService(Fleet, concurrent));
	return reconciled;
});
