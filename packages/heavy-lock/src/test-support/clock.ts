import { Clock, Console, Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { HeldLock } from "#held-lock.ts";
import { readHolder } from "#lock-file.ts";
import { withHeavyLock } from "#with-heavy-lock.ts";
import { waitFor } from "./cliProcess.ts";
import { configured, type Lock } from "./lock.ts";

const startWaiting = Effect.fn("LockStory.startWaiting")(function* (engine: Lock, tell: (line: string) => void, startMs: number) {
	tell(`a command starts waiting at ${startMs}ms`);
	yield* TestClock.setTime(startMs);
	const testClock = yield* Clock.Clock;
	const output = yield* Console.Console;
	const lines: string[] = [];
	let polls = 0;
	let holding = false;
	const observedClock: Clock.Clock = {
		...testClock,
		sleep: (duration) =>
			Effect.sync(() => {
				polls += 1;
			}).pipe(Effect.andThen(testClock.sleep(duration))),
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
		holding = true;
		yield* Deferred.succeed(acquired, { env, holder: yield* readHolder(engine.lock) });
		yield* Deferred.await(finish);
	});
	const worker = yield* Effect.forkChild(
		configured(engine, withHeavyLock(command, engine.options)).pipe(
			Effect.provideService(Clock.Clock, observedClock),
			Effect.provideService(Console.Console, observedConsole),
		),
	);
	yield* Effect.promise(() => waitFor(() => polls > 0));
	function pollFinished(before: number) {
		return Effect.promise(() => waitFor(() => polls > before || holding));
	}
	return {
		advance: (milliseconds: number) =>
			Effect.gen(function* () {
				tell(`time advances ${milliseconds}ms`);
				for (let elapsed = 0; elapsed < milliseconds; elapsed += 10_000) {
					const before = polls;
					yield* TestClock.adjust(Math.min(10_000, milliseconds - elapsed));
					yield* pollFinished(before);
				}
			}),
		finish: () =>
			Effect.gen(function* () {
				const held = yield* Deferred.await(acquired);
				yield* Deferred.succeed(finish, undefined);
				yield* Fiber.join(worker);
				return held;
			}),
		lines: () => lines,
	};
});

export function clock(engine: Lock, tell: (line: string) => void) {
	return { wait: (startMs = 0) => startWaiting(engine, tell, startMs) };
}
