import { Clock, Duration, Effect, Queue } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { withLive } from "@shivaedev/test/withLive.ts";
import { storyKit } from "#storyKit.ts";
import { passes, untilTimer } from "#watchedClock.ts";
import { attempt, background } from "./attempt.ts";

function timerKit(clock: "live" | "test" = "test") {
	return storyKit({
		clock,
		*create() {
			return {
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
				return (live ? withLive(task) : task).pipe(Effect.forkScoped, Effect.asVoid);
			}
			return {
				cancelWait: () => engine.running.cancel("timer wait"),
				ending: () => engine.ending,
				starts,
				startsLive: (name: string, intervals: readonly Duration.Input[]) => starts(name, intervals, true),
				startsOnNestedLiveClock: (name: string, interval: Duration.Input) =>
					Effect.gen(function* () {
						story.tell(`${name} starts on a nested clock's live clock`);
						const nestedClock = yield* TestClock.make();
						yield* nestedClock.withLive(Effect.sleep(interval).pipe(Effect.andThen(Queue.offer(engine.completed, name)))).pipe(Effect.forkScoped);
					}),
				time: () => Clock.currentTimeMillis,
				timePasses: (interval: Duration.Input) => {
					story.tell(`${interval} pass and the task completes`);
					return passes(interval, Queue.take(engine.completed));
				},
				waitForTimer: (interval: Duration.Input, options?: { readonly timeout: Duration.Input }) => {
					story.tell(`wait until a sleep for ${interval} starts`);
					return untilTimer(interval, options).pipe(Effect.map(Duration.toMillis));
				},
				waitsInBackground: (interval: Duration.Input) => engine.running.starts("timer wait", untilTimer(interval)),
				waitWithoutTimer: (interval: Duration.Input) => {
					story.tell(`wait without a task that sleeps for ${interval}`);
					return attempt(untilTimer(interval, { timeout: "30 millis" })).pipe(Effect.tap(rememberEnding));
				},
			};
		},
	});
}

export const timers = timerKit();
export const liveTimers = timerKit("live");
