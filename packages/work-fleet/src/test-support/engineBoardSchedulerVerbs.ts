import { Clock, Deferred, Effect } from "effect";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { BoardGateway } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
import { boardScheduler } from "#test/boardScheduler.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineBoardSchedulerVerbs(state: EngineStory, tell: (line: string) => void) {
	return {
		startBoardReadScheduler: (stored: Versioned<FleetRecord>) =>
			Effect.gen(function* () {
				tell("start a scheduler whose reconciliation waits across the next sleep");
				if (state.sourceReads === undefined) {
					return yield* Effect.die("No tracked Board source is configured");
				}
				const board = yield* BoardGateway.pipe(Effect.provide(state.sourceReads.board));
				const schedule = yield* boardScheduler(running(state).fleet, stored, board.get("item.0"));
				const clock = yield* Clock.Clock;
				const sleeping = yield* Deferred.make<void>();
				const runner = yield* Effect.scoped(run(Effect.sleep("5 seconds"), board.get("item.0").pipe(Effect.asVoid, Effect.orDie))).pipe(
					Effect.provideService(Fleet, schedule.fleet),
					Effect.provideService(Clock.Clock, {
						...clock,
						sleep: (duration) => Deferred.succeed(sleeping, undefined).pipe(Effect.andThen(clock.sleep(duration))),
					}),
					Effect.forkChild,
				);
				return { dispatched: schedule.dispatched, read: schedule.read, release: schedule.release, runner, sleeping: Deferred.await(sleeping) };
			}),
	};
}
