import { DateTime, Duration, Effect, Queue } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { withLive } from "@shivaedev/test/withLive.ts";
import { storyKit } from "#server/storyKit.ts";
import { passes, untilTimer } from "#server/watchedClock.ts";
import { attempt, background } from "./attempt.ts";
import { drivenClock } from "./drivenClock.ts";

function timerKit(clock: "test" | DateTime.Utc = "test") {
	return storyKit({
		clock,
		*create() {
			return {
				clock: yield* drivenClock,
				completed: yield* Queue.unbounded<string>(),
				ending: "not started",
				running: background(),
			};
		},
		name: "timers",
		stages: [],
		verbs: (engine, story) => {
			function rememberEnding(ending: string) {
				return Effect.sync(() => {
					engine.ending = ending;
				});
			}
			function starts(name: string, intervals: readonly Duration.Input[], live = false) {
				story.tell(`${name} starts`);
				const task = Effect.forEach(intervals, (interval) => Effect.sleep(interval).pipe(Effect.andThen(Queue.offer(engine.completed, name))));
				return live ? engine.clock.drive(withLive(task)).pipe(Effect.asVoid) : engine.clock.run(task).pipe(Effect.forkScoped, Effect.asVoid);
			}
			return {
				cancelWait: () => engine.running.cancel("timer wait"),
				ending: () => engine.ending,
				starts,
				startsLive: (name: string, intervals: readonly Duration.Input[]) => starts(name, intervals, true),
				startsOnNestedLiveClock: (name: string, interval: Duration.Input) =>
					Effect.gen(function* () {
						story.tell(`${name} starts on a nested clock's live clock`);
						const nestedClock = yield* engine.clock.run(TestClock.make());
						yield* engine.clock.drive(nestedClock.withLive(Effect.sleep(interval).pipe(Effect.andThen(Queue.offer(engine.completed, name)))));
					}),
				time: () => engine.clock.time,
				timePasses: (interval: Duration.Input) => {
					story.tell(`${interval} pass and the task completes`);
					return engine.clock.run(passes(interval, Queue.take(engine.completed)));
				},
				waitForTimer: (interval: Duration.Input, options?: { readonly timeout: Duration.Input }) => {
					story.tell(`wait until a sleep for ${interval} starts`);
					const wait = untilTimer(interval, options).pipe(Effect.map(Duration.toMillis));
					return options === undefined ? engine.clock.run(wait) : engine.clock.drive(wait);
				},
				waitsInBackground: (interval: Duration.Input) => engine.running.starts("timer wait", engine.clock.run(untilTimer(interval))),
				waitWithoutTimer: (interval: Duration.Input) => {
					story.tell(`wait without a task that sleeps for ${interval}`);
					return engine.clock.drive(attempt(untilTimer(interval, { timeout: "30 millis" }))).pipe(Effect.tap(rememberEnding));
				},
			};
		},
	});
}

export const timers = timerKit();
export const pinnedTimers = timerKit(DateTime.makeUnsafe("2026-10-17T12:34:56.000Z"));
