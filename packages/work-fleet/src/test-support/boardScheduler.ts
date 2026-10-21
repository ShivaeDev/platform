import { Deferred, Effect } from "effect";
import type { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardFailure, BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const boardScheduler = Effect.fn("FleetTest.boardScheduler")(function* (
	fleet: Effect.Success<typeof Fleet>,
	stored: Versioned<FleetRecord>,
	readWork: Effect.Effect<BoardWork, BoardFailure>,
) {
	const dispatched = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const read = yield* Deferred.make<BoardWork>();
	let lists = 0;
	return {
		dispatched: Deferred.await(dispatched),
		fleet: {
			...fleet,
			list: () =>
				Effect.gen(function* () {
					lists += 1;
					if (lists === 1) {
						return [{ ...stored, value: { ...stored.value, step: "working" as const } }];
					}
					yield* Deferred.succeed(dispatched, undefined);
					return [];
				}),
			reconcile: () =>
				Effect.gen(function* () {
					yield* Deferred.await(release);
					const work = yield* readWork;
					yield* Deferred.succeed(read, work);
					return stored;
				}),
		},
		read: Deferred.await(read),
		release: Deferred.succeed(release, undefined),
	};
});
