import { Clock, Console, Deferred, Duration, Effect, Exit, Fiber, Queue } from "effect";
import { TestClock } from "effect/testing";
import { HeldLock } from "#HeldLock.ts";
import { readHolder } from "#lockFile.ts";
import { withHeavyLock } from "#withHeavyLock.ts";
import { configured, type Lock } from "./lock.ts";

const startWaiting = Effect.fn("LockStory.startWaiting")(function* (engine: Lock, tell: (line: string) => void, startMs: number) {
	tell(`a command starts waiting at ${startMs}ms`);
	yield* TestClock.setTime(startMs);
	const testClock = yield* Clock.Clock;
	const output = yield* Console.Console;
	const lines: string[] = [];
	const wakeups = yield* Queue.unbounded<number>();
	const observedClock: Clock.Clock = {
		...testClock,
		sleep: (duration) =>
			Queue.offer(wakeups, testClock.currentTimeMillisUnsafe() + Duration.toMillis(duration)).pipe(Effect.andThen(testClock.sleep(duration))),
	};
	const observedConsole: Console.Console = {
		...output,
		error: (line) => {
			lines.push(String(line));
			output.error(line);
		},
	};
	const acquired = yield* Deferred.make<{ env: Readonly<Record<string, string>>; holder: Effect.Success<ReturnType<typeof readHolder>> }>();
	const finish = yield* Deferred.make<void>();
	const command = Effect.gen(function* () {
		const { env } = yield* HeldLock;
		yield* Deferred.succeed(acquired, { env, holder: yield* readHolder(engine.lock) });
		yield* Queue.offer(wakeups, Number.POSITIVE_INFINITY);
		yield* Deferred.await(finish);
	});
	const worker = yield* Effect.forkChild(
		configured(engine, withHeavyLock(command, engine.options)).pipe(
			Effect.provideService(Clock.Clock, observedClock),
			Effect.provideService(Console.Console, observedConsole),
		),
	);
	const nextObservation = Effect.raceFirst(
		Queue.take(wakeups),
		Fiber.await(worker).pipe(
			Effect.flatMap((exit) =>
				Exit.isFailure(exit) ? Effect.failCause(exit.cause) : Effect.die(new Error("The lock waiter exited without a clock observation.")),
			),
		),
	);
	let nextWakeup = yield* nextObservation;
	return {
		advance: (milliseconds: number) =>
			Effect.gen(function* () {
				tell(`time advances ${milliseconds}ms`);
				const target = testClock.currentTimeMillisUnsafe() + milliseconds;
				while (nextWakeup <= target) {
					yield* TestClock.setTime(nextWakeup);
					nextWakeup = yield* nextObservation;
				}
				yield* TestClock.setTime(target);
			}),
		finish: () =>
			Effect.gen(function* () {
				const held = yield* Deferred.await(acquired);
				yield* Deferred.succeed(finish, undefined);
				yield* Fiber.join(worker);
				return held;
			}),
		interrupt: () => {
			tell("the waiting command is interrupted");
			return Fiber.interrupt(worker);
		},
		lines: () => lines,
	};
});

export function clock(engine: Lock, tell: (line: string) => void) {
	return { wait: (startMs = 0) => startWaiting(engine, tell, startMs) };
}
