import { Effect, Exit } from "effect";
import { argumentsFor, help } from "#arguments.ts";
import { type Emit, health, makeOutput } from "#health.ts";
import type { WatchError } from "#model.ts";
import { Watcher } from "#Watcher.ts";

export const program = Effect.fn("PrWatch.program")(function* (
	args: readonly string[],
	emit: Emit,
	diagnostic: (message: string) => Effect.Effect<void, WatchError>,
) {
	let reported: string | undefined;
	let watching = true;
	const run = Effect.gen(function* () {
		const parsed = yield* argumentsFor(args);
		if (parsed.help) {
			watching = false;
			yield* emit(help);
			return;
		}
		const watcher = yield* Watcher;
		const output = yield* makeOutput(emit, parsed.heartbeat);
		let state = yield* watcher.load(parsed.options);
		function report(message: string) {
			return health(output.emit, "error", { message }).pipe(
				Effect.tap(
					Effect.sync(() => {
						reported = message;
					}),
				),
				Effect.andThen(diagnostic(message)),
			);
		}
		while (true) {
			reported = undefined;
			state = yield* watcher.poll(parsed.options, state, output.emit, report);
			if (parsed.once) {
				return;
			}
			yield* output.waitForPoll(parsed.options.interval, yield* watcher.delay(parsed.options.interval));
		}
	});
	yield* run.pipe(
		Effect.tapError((error) =>
			Effect.gen(function* () {
				if (reported !== error.message) {
					yield* health(emit, "error", { message: error.message });
				}
				if (error.retryAt !== undefined) {
					yield* health(emit, "cooldown", { message: error.message, nextPollAt: new Date(error.retryAt).toISOString() });
				}
			}),
		),
		Effect.onExit((exit) => {
			if (!watching) {
				return Effect.void;
			}
			let reason = "completed";
			if (exit._tag === "Failure") {
				reason = Exit.hasInterrupts(exit) ? "interrupted" : "failed";
			}
			return health(emit, "stopped", { reason }).pipe(Effect.orDie);
		}),
	);
});
