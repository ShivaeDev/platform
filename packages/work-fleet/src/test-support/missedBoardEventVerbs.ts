import { Clock, Context, Deferred, Duration, Effect, Fiber, PubSub, Stream } from "effect";
import { BoardIndex } from "#board/Index.ts";
import { hostScheduler } from "#host/commands.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

function indexedWork(index: typeof BoardIndex.Service.index, workId: string) {
	return Effect.scoped(
		Effect.gen(function* () {
			const events = yield* PubSub.subscribe(index.changes.events);
			return yield* Stream.fromEffect(index.read).pipe(
				Stream.concat(Stream.fromSubscription(events).pipe(Stream.mapEffect(() => index.read))),
				Stream.filter((snapshot) => snapshot.model.ids.has(workId)),
				Stream.take(1),
				Stream.runDrain,
			);
		}),
	);
}

export function missedBoardEventVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		startWithoutBoardEvents: () =>
			Effect.gen(function* () {
				tell("start the real scheduler while its Board change subscription loses notifications");
				const shared = Context.get(engine.running.context, BoardIndex);
				const events = yield* Effect.acquireRelease(
					PubSub.sliding<typeof shared.index.changes.events extends PubSub.PubSub<infer A> ? A : never>(1),
					PubSub.shutdown,
				);
				const elapsed = yield* Deferred.make<void>();
				const paused = yield* Deferred.make<void>();
				const live = yield* Clock.Clock;
				let held = true;
				const clock: Clock.Clock = {
					currentTimeMillis: live.currentTimeMillis,
					currentTimeMillisUnsafe: () => live.currentTimeMillisUnsafe(),
					currentTimeNanos: live.currentTimeNanos,
					currentTimeNanosUnsafe: () => live.currentTimeNanosUnsafe(),
					monotonicTimeNanos: live.monotonicTimeNanos,
					monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
					sleep: (duration) => {
						if (Duration.toMillis(duration) !== 60_000 || !held) {
							return live.sleep(duration);
						}
						held = false;
						return Deferred.succeed(paused, undefined).pipe(Effect.andThen(Deferred.await(elapsed)));
					},
				};
				const observed = { ...shared, index: { ...shared.index, changes: { ...shared.index.changes, events } } };
				const context = engine.running.context.pipe(Context.add(BoardIndex, observed), Context.add(Clock.Clock, clock));
				const scheduler = yield* hostScheduler(engine.fixture.host).pipe(Effect.provideContext(context), Effect.forkScoped);
				yield* Effect.raceFirst(Deferred.await(paused), Fiber.join(scheduler));
				return {
					elapse: Deferred.succeed(elapsed, undefined),
					indexed: (workId: string) => indexedWork(shared.index, workId),
				};
			}),
	};
}
