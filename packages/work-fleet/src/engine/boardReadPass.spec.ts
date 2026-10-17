import { expect } from "@effect/vitest";
import { Clock, Deferred, Effect, Fiber } from "effect";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";
import { boardScheduler } from "#test/boardScheduler.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("test", "isolated")("a reconcile forked before sleep sees a Board edit made during the scheduler sleep", function* () {
	const fixture = yield* boardReads(1);
	const board = yield* BoardGateway.pipe(Effect.provide(fixture.board));
	yield* withEngine(
		{},
		() =>
			Effect.gen(function* () {
				const stored = yield* prepareWork("item.0");
				const fleet = yield* Fleet;
				const schedule = yield* boardScheduler(fleet, stored, board.get("item.0"));
				const before = fixture.scans();
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
				yield* schedule.dispatched;
				yield* Deferred.await(sleeping);
				yield* fixture.write("0.md", fixture.source("item.0", false, "Edited during scheduler sleep."));
				yield* schedule.release;
				const reconciled = yield* schedule.read;
				expect(reconciled.approved).toBe(false);
				expect(reconciled.context).toContain("Edited during scheduler sleep.");
				yield* Fiber.interrupt(runner);
				expect(fixture.scans()).toBe(before + 2);
			}),
		fixture.board,
	);
});
