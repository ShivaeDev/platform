import { Cause, Deferred, Effect, Exit, Queue, type Scope, Semaphore, SubscriptionRef } from "effect";
import { PassState } from "#PassState.ts";
import type { Reconciler, State } from "#Reconciler.ts";

export interface FailureHandler<E, TRecordError, TRecordServices> {
	readonly onFailure?: (cause: Cause.Cause<E>) => Effect.Effect<unknown, TRecordError, TRecordServices>;
}

export const supervise = Effect.fnUntraced(function* <E, R, TRecordError = never, TRecordServices = never>(
	open: (pending: Queue.Queue<void>) => Effect.Effect<never, E, R | Scope.Scope | PassState>,
	options: FailureHandler<E, TRecordError, TRecordServices>,
): Effect.fn.Return<Reconciler<E | TRecordError>, never, R | TRecordServices | Scope.Scope> {
	const lifetime = yield* Effect.scope;
	const context = yield* Effect.context<R | TRecordServices>();
	const state = yield* SubscriptionRef.make<State<E | TRecordError>>({ status: "running" });
	const lock = yield* Semaphore.make(1);
	let completion = yield* Deferred.make<void, E | TRecordError>();
	let refresh: Effect.Effect<void> = Effect.void;
	const launch = Effect.uninterruptible(
		Effect.gen(function* () {
			const pending = yield* Queue.sliding<void>(1);
			refresh = Queue.offer(pending, undefined).pipe(Effect.asVoid);
			const finished = yield* Deferred.make<void, E | TRecordError>();
			completion = finished;
			yield* SubscriptionRef.set(state, { status: "running" });
			const work = Effect.gen(function* () {
				const opening = open(pending).pipe(
					Effect.provideService(PassState, {
						running: SubscriptionRef.set(state, { status: "running" }),
						waiting: (nextDue) => SubscriptionRef.set(state, { nextDue, status: "waiting" }),
					}),
				);
				const exit = yield* Effect.exit(Effect.scoped(opening));
				if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) {
					return yield* Deferred.done(finished, exit);
				}
				const recorded = yield* Effect.exit(Effect.suspend(() => options.onFailure?.(exit.cause) ?? Effect.void));
				const cause = Exit.isFailure(recorded) ? Cause.combine(exit.cause, recorded.cause) : exit.cause;
				yield* SubscriptionRef.set(state, { cause, status: "failed" });
				return yield* Deferred.failCause(finished, cause);
			});
			yield* Effect.forkIn(
				work.pipe(
					Effect.asVoid,
					Effect.onExit((exit) => Deferred.done(finished, exit)),
					Effect.provideContext(context),
				),
				lifetime,
			);
		}),
	);
	yield* launch;
	return {
		await: Effect.suspend(() => Deferred.await(completion)),
		refresh: Effect.suspend(() => refresh),
		resume: Semaphore.withPermit(lock)(
			Effect.gen(function* () {
				const current = yield* SubscriptionRef.get(state);
				if (current.status === "failed") {
					yield* launch;
				}
			}),
		),
		state,
	};
});
