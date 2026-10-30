import { Clock, Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { program } from "#program.ts";
import { type Engine, programArguments } from "./engine.ts";
import { clockTime, cooldown, healthOf, heartbeat } from "./readouts.ts";
import { diagnosticTo, emitTo } from "./watcherVerbs.ts";

function withArguments(extra: readonly string[]) {
	return extra.length === 0 ? "" : ` with ${extra.join(" ")}`;
}

export function processVerbs(engine: Engine, tell: (line: string) => void) {
	const { process } = engine;
	const settled = process.settledUnless(() => engine.io.control.stalled > 0);
	function run(extra: readonly string[]) {
		return program(programArguments(engine, ...extra), emitTo(engine), diagnosticTo(engine)).pipe(Effect.provide(engine.context));
	}
	return {
		asksForHelp: () =>
			Effect.gen(function* () {
				tell("the watcher is asked for --help");
				yield* run(["--help"]).pipe(Effect.ignore);
			}),
		cooldownLengths: () => Effect.sync(() => healthOf(engine.lines, "cooldown").map(({ delayMs = 0 }) => `${delayMs / 1000} s`)),
		cooldowns: () => Effect.sync(() => healthOf(engine.lines, "cooldown").map(cooldown)),
		errors: () => Effect.sync(() => healthOf(engine.lines, "error").map(({ message }) => message)),
		heartbeats: () => Effect.sync(() => healthOf(engine.lines, "heartbeat").map(heartbeat)),
		howItStopped: () =>
			Effect.sync(() => {
				const stopped = healthOf(engine.lines, "stopped").at(-1);
				return stopped === undefined ? "still running" : `${stopped.reason} at ${clockTime(stopped.at ?? "")}`;
			}),
		interrupt: () =>
			Effect.gen(function* () {
				tell("the continuous watch is interrupted");
				if (process.state.fiber === undefined) {
					return yield* Effect.die(new Error("Start the watch before interrupting it"));
				}
				yield* Fiber.interrupt(process.state.fiber);
			}),
		lastError: () => Effect.sync(() => healthOf(engine.lines, "error").at(-1)?.message ?? "none"),
		requestTimesOut: () =>
			Effect.gen(function* () {
				tell("the stalled request reaches its 30-second timeout");
				yield* process.until(() => engine.io.control.stalled > 0);
				yield* TestClock.setTime(yield* process.timerStarted);
				yield* process.until(() => engine.io.control.stalled === 0);
				yield* settled;
			}),
		runOnce: (...extra: string[]) =>
			Effect.gen(function* () {
				tell(`the watcher runs one round with --once${withArguments(extra)}`);
				engine.roundStart = engine.github.requests.length;
				yield* run(["--once", ...extra]).pipe(Effect.ignore);
			}),
		startWatch: (...extra: string[]) =>
			Effect.gen(function* () {
				tell(`the continuous watch starts${withArguments(extra)}`);
				engine.roundStart = engine.github.requests.length;
				process.state.fiber = yield* Effect.forkChild(
					process.identify(run(extra)).pipe(Effect.provideService(Clock.Clock, process.clock), Effect.ensuring(Effect.sync(process.finished))),
				);
				yield* settled;
			}),
		timePasses: (duration: Duration.Input) =>
			Effect.gen(function* () {
				tell(`${String(duration)} pass`);
				const clock = yield* Clock.Clock;
				const target = clock.currentTimeMillisUnsafe() + Duration.toMillis(duration);
				yield* settled;
				while (!process.state.finished && process.state.wakeAt !== undefined && process.state.wakeAt <= target) {
					yield* TestClock.setTime(process.state.wakeAt);
					yield* settled;
				}
				yield* TestClock.setTime(target);
			}),
	};
}
