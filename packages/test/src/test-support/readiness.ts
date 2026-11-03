import { Clock, Duration, Effect } from "effect";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type EventuallyOptions, eventually } from "#eventually.ts";
import { driveClock } from "./driveClock.ts";

function notReady(message: string) {
	return Effect.fail(new Error(message));
}

type Check = (attempt: number, now: number) => Effect.Effect<string, unknown>;

interface ReadinessEngine {
	answer: unknown;
	readonly attempts: number[];
	check: Check;
	withoutTestClock: boolean;
}

function readinessEngine(): ReadinessEngine {
	return {
		answer: undefined,
		attempts: [],
		check: () => Effect.die(new Error("Give the check a trait before waiting for it")),
		withoutTestClock: false,
	};
}

function budgetOf(options: EventuallyOptions = {}) {
	const budget = [
		options.interval === undefined ? "the default interval" : `${Duration.format(Duration.fromInputUnsafe(options.interval))} intervals`,
		...(options.times === undefined ? [] : [`${options.times} retries`]),
		...(options.timeout === undefined ? [] : [`a ${Duration.format(Duration.fromInputUnsafe(options.timeout))} timeout`]),
	];
	return budget.join(", ");
}

export const readiness = storyKit({
	create: readinessEngine,
	inspect: ({ answer, attempts }) => ({ answer, attempts }),
	name: "readiness check",
	stages: ["clock", "check"],
	verbs: (engine, story) => ({
		answer: () => Effect.sync(() => engine.answer),
		attempts: () => Effect.sync(() => engine.attempts.length),
		attemptTimes: () => Effect.sync(() => engine.attempts.map((time) => time - (engine.attempts[0] ?? 0))),
		shortestWait: () =>
			Effect.sync(() => {
				const waits = engine.attempts.slice(1).map((time, index) => time - (engine.attempts[index] ?? time));
				return waits.length === 0 ? "no wait: the check ran once" : Math.min(...waits);
			}),
		waitsUntilReady: (options?: EventuallyOptions) => {
			story.tell(`eventually waits for the check with ${budgetOf(options)}`);
			const attempt = Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				engine.attempts.push(now);
				return yield* engine.check(engine.attempts.length, now);
			});
			const waiting = eventually(attempt, options);
			return Effect.map(answered(engine.withoutTestClock ? driveClock(waiting) : waiting), (answer) => {
				engine.answer = answer;
			});
		},
	}),
});

export const withoutTestClock = readiness.trait("clock", "the check uses a controlled Clock without TestClock's controls", (engine) => {
	engine.withoutTestClock = true;
});

function check(line: string, next: Check) {
	return readiness.trait("check", line, (engine) => {
		engine.check = next;
	});
}

export function readyFrom(millis: number) {
	return check(`the check answers not ready until the clock reaches ${millis} ms`, (_attempt, now) =>
		now >= millis ? Effect.succeed(`ready at ${now} ms`) : notReady(`not ready at ${now} ms`),
	);
}

export function readyOnAttempt(ready: number) {
	return check(`the check answers not ready until attempt ${ready}`, (attempt) =>
		attempt >= ready ? Effect.succeed(`ready on attempt ${attempt}`) : notReady("not ready"),
	);
}

export function neverReady() {
	return check("the check always answers not ready", (_attempt, now) => notReady(`not ready at ${now} ms`));
}

export function assertionThrowsUntil(ready: number) {
	return check(`the check throws a failed assertion until attempt ${ready}`, (attempt) =>
		Effect.sync(() => {
			if (attempt < ready) {
				throw new Error("the assertion failed");
			}
			return `ready on attempt ${attempt}`;
		}),
	);
}

export function assertionCapturedUntil(ready: number) {
	return check(`the check captures its failed assertion with Effect.try until attempt ${ready}`, (attempt) =>
		Effect.try(() => {
			if (attempt < ready) {
				throw new Error("the assertion failed");
			}
			return `ready on attempt ${attempt}`;
		}),
	);
}

export function interruptsItself() {
	return check("the check interrupts itself", () => Effect.interrupt);
}
