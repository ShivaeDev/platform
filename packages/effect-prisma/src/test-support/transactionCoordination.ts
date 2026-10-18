import { Deferred, Effect, Fiber } from "effect";
import { publicFailure } from "#test/publicFailure.ts";
import type { QueryControl } from "#test/queryControls.ts";
import { controlledQuery } from "#test/queryProbes.ts";
import { type RuntimeControls, signal } from "#test/runtimeControls.ts";
import { Database } from "#test/sqlite/database.ts";

export function transactionCoordination(db: Effect.Success<typeof Database>, controls: RuntimeControls, state: () => QueryControl) {
	const drain = Effect.fnUntraced(function* () {
		const control = state();
		const bodyReturned = signal();
		const body = Effect.gen(function* () {
			const query = controlledQuery(yield* Database);
			const active = yield* Effect.forkChild(query, { startImmediately: true });
			yield* control.first.wait;
			const recordFailure = query.pipe(
				Effect.tapError((error) =>
					Effect.sync(() => {
						if (error.reason._tag === "PrismaRuntimeFailure") {
							controls.calls.push(`queued:${error.reason.code}`);
						}
					}),
				),
			);
			const queued = yield* Effect.forkChild(Effect.exit(recordFailure), { startImmediately: true });
			bodyReturned.resolve();
			return { active, queued };
		});
		const settlement = yield* Effect.forkChild(db.transaction(body), { startImmediately: true });
		yield* bodyReturned.wait;
		yield* Effect.yieldNow;
		const whileQueryRuns = [...controls.calls];
		control.release();
		const { active, queued } = yield* Fiber.join(settlement);
		yield* Fiber.join(active);
		const queuedError = publicFailure(yield* Fiber.join(queued)).reason;
		return { calls: [...controls.calls], queuedError, whileQueryRuns };
	});
	const interruptPermit = Effect.fnUntraced(function* () {
		const firstEntered = yield* Deferred.make<void>();
		const secondEntered = yield* Deferred.make<void>();
		const firstBody = Effect.gen(function* () {
			yield* Database;
			yield* Deferred.succeed(firstEntered, undefined);
			yield* Effect.never;
		});
		const secondBody = Effect.gen(function* () {
			yield* Database;
			return yield* Deferred.succeed(secondEntered, undefined);
		});
		const first = yield* Effect.forkChild(db.transaction(firstBody), { startImmediately: true });
		yield* Deferred.await(firstEntered);
		const second = yield* Effect.forkChild(db.transaction(secondBody), { startImmediately: true });
		yield* Effect.yieldNow;
		const beforeInterruption = yield* Deferred.isDone(secondEntered);
		const interruption = yield* Effect.forkChild(Fiber.interrupt(first), { startImmediately: true });
		yield* controls.settlementStarted.wait;
		const duringSettlement = yield* Deferred.isDone(secondEntered);
		controls.releaseSettlement.resolve();
		yield* Fiber.join(interruption);
		yield* Fiber.join(second);
		const afterSettlement = yield* Deferred.isDone(secondEntered);
		return { afterSettlement, beforeInterruption, duringSettlement };
	});
	return { drain, interruptPermit };
}
