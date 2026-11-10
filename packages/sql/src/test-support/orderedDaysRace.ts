import { Deferred, Effect, Fiber } from "effect";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import type { OrderedDaysEngine } from "#test/orderedDaysEngine.ts";
import { transact } from "#transact.ts";

export function orderedDaysRace({ order, parentTable, sql }: OrderedDaysEngine, tell: (line: string) => void) {
	const release = Deferred.makeUnsafe<void>();
	let holder: Fiber.Fiber<void, unknown> | undefined;
	let contender: Fiber.Fiber<void, unknown> | undefined;
	let contenderPid = -1;
	return {
		finishReorders: () =>
			Effect.gen(function* () {
				if (holder === undefined || contender === undefined) {
					return yield* Effect.die(new Error("Start both reorders first"));
				}
				tell("the first reorder commits and the waiting reorder finishes");
				yield* Deferred.succeed(release, undefined);
				yield* Fiber.join(holder);
				yield* Fiber.join(contender);
			}),
		startCompetingReorder: () =>
			Effect.gen(function* () {
				tell("a second transaction reorders plan one");
				const started = yield* Deferred.make<number>();
				contender = yield* Effect.forkScoped(
					transact(
						Effect.gen(function* () {
							const [row] = yield* sql<{ readonly pid: number }>`select pg_backend_pid() as pid`;
							yield* Deferred.succeed(started, row?.pid ?? -1);
							yield* order.reorder(1, [2, 1, 3]);
						}),
					),
				);
				contenderPid = yield* Deferred.await(started);
			}),
		startHeldReorder: () =>
			Effect.gen(function* () {
				tell("reorder plan one and hold its transaction open");
				const entered = yield* Deferred.make<void>();
				holder = yield* Effect.forkScoped(
					transact(
						Effect.gen(function* () {
							yield* order.reorder(1, [3, 2, 1]);
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(release);
						}),
					),
				);
				yield* Effect.raceFirst(
					Deferred.await(entered),
					Effect.andThen(Fiber.join(holder), Effect.die(new Error("The reorder ended before pausing"))),
				);
			}),
		waitingReorder: () =>
			Effect.gen(function* () {
				if (contender === undefined) {
					return yield* Effect.die(new Error("Start the competing reorder first"));
				}
				const waiting = observeUntil(
					sql<{
						readonly blocked: boolean;
					}>`select cardinality(pg_blocking_pids(${contenderPid})) > 0 and query like ${`%${parentTable}%for update%`} as blocked from pg_stat_activity where pid = ${contenderPid}`,
					(rows) => rows[0]?.blocked === true,
					"the competing reorder to wait on the parent lock",
					{ clock: "test" },
				);
				yield* Effect.raceFirst(waiting, Effect.andThen(Fiber.join(contender), Effect.die(new Error("The competing reorder did not wait"))));
				return "waiting on the parent lock";
			}),
	};
}
