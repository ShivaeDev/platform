import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";
import { boardScheduler } from "#test/boardScheduler.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

it.live.skipIf(storageDatabaseUrl === undefined)(
	"reconciliation shares the pass snapshot after dispatch finishes and before the next pass",
	function* () {
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
					const runner = yield* Effect.scoped(run("5 seconds", board.get("item.0").pipe(Effect.asVoid, Effect.orDie))).pipe(
						Effect.provideService(Fleet, schedule.fleet),
						Effect.forkChild,
					);
					yield* schedule.dispatched;
					yield* Effect.sleep("5 millis");
					yield* schedule.release;
					yield* schedule.read;
					yield* Fiber.interrupt(runner);
					expect(fixture.scans()).toBe(before + 1);
				}),
			fixture.board,
		);
	},
);
