import { Deferred, Effect, Exit, Fiber, Semaphore } from "effect";
import { executeQuery } from "#internal/query-execution.ts";
import { releaseTransaction, withTransactionSemaphore } from "#internal/transaction.ts";
import { makeTransactionResource as makeResource } from "#test/makeTransactionResource.ts";

const drain = Effect.fnUntraced(function* () {
	const { calls, resource } = makeResource();
	const queryStarted = yield* Deferred.make<void>();
	const releaseQuery = yield* Deferred.make<void>();
	const active = yield* Effect.forkChild(
		executeQuery(
			resource.executor,
			Effect.gen(function* () {
				calls.push("query1");
				yield* Deferred.succeed(queryStarted, undefined);
				yield* Deferred.await(releaseQuery);
			}),
		),
		{ startImmediately: true },
	);
	yield* Deferred.await(queryStarted);
	const queued = yield* Effect.forkChild(
		executeQuery(
			resource.executor,
			Effect.sync(() => calls.push("query2")),
		).pipe(
			Effect.tapError((error) =>
				Effect.sync(() => {
					if (error.reason._tag === "PrismaRuntimeFailure") {
						calls.push(`queued:${error.reason.code}`);
					}
				}),
			),
		),
		{ startImmediately: true },
	);
	const settlement = yield* Effect.forkChild(releaseTransaction(resource, Exit.succeed(undefined)), { startImmediately: true });

	yield* Effect.yieldNow;
	const observedWhileQueryRuns = [...calls];
	yield* Deferred.succeed(releaseQuery, undefined);
	yield* Fiber.join(active);
	const queuedError = yield* Effect.flip(Fiber.join(queued));
	yield* Fiber.join(settlement);

	const observedQueuedError = queuedError.reason;
	const observedCalls = [...calls];
	return { calls: observedCalls, queuedError: observedQueuedError, whileQueryRuns: observedWhileQueryRuns };
});
const interruptPermit = Effect.fnUntraced(function* () {
	const semaphore = Semaphore.makeUnsafe(1);
	const firstEntered = yield* Deferred.make<void>();
	const settlementStarted = yield* Deferred.make<void>();
	const releaseSettlement = yield* Deferred.make<void>();
	const secondEntered = yield* Deferred.make<void>();
	const firstScope = Effect.acquireUseRelease(
		Effect.void,
		() =>
			Effect.gen(function* () {
				yield* Deferred.succeed(firstEntered, undefined);
				yield* Effect.never;
			}),
		() =>
			Effect.gen(function* () {
				yield* Deferred.succeed(settlementStarted, undefined);
				yield* Deferred.await(releaseSettlement);
			}),
	);
	const first = yield* Effect.forkChild(withTransactionSemaphore(semaphore, firstScope), { startImmediately: true });
	yield* Deferred.await(firstEntered);
	const second = yield* Effect.forkChild(withTransactionSemaphore(semaphore, Deferred.succeed(secondEntered, undefined)), {
		startImmediately: true,
	});
	yield* Effect.yieldNow;
	const observedBeforeInterruption = yield* Deferred.isDone(secondEntered);
	const interruption = yield* Effect.forkChild(Fiber.interrupt(first), {
		startImmediately: true,
	});
	yield* Deferred.await(settlementStarted);
	const observedDuringSettlement = yield* Deferred.isDone(secondEntered);

	yield* Deferred.succeed(releaseSettlement, undefined);
	yield* Fiber.join(interruption);
	yield* Fiber.join(second);
	const observedAfterSettlement = yield* Deferred.isDone(secondEntered);
	return {
		afterSettlement: observedAfterSettlement,
		beforeInterruption: observedBeforeInterruption,
		duringSettlement: observedDuringSettlement,
	};
});
export function transactionCoordination() {
	return { drain, interruptPermit };
}
