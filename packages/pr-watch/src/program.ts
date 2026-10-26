import { Effect, Exit } from "effect";
import { argumentsFor, help } from "#arguments.ts";
import { type Emit, health, makeOutput } from "#health.ts";
import type { WatchError } from "#model.ts";
import { polling } from "#polling.ts";

export const program = Effect.fn("PrWatch.program")(function* (
	args: readonly string[],
	emit: Emit,
	diagnostic: (message: string) => Effect.Effect<void, WatchError>,
) {
	const reported = new Set<string>();
	let watching = true;
	const run = Effect.gen(function* () {
		const parsed = yield* argumentsFor(args);
		if (parsed.help) {
			watching = false;
			yield* emit(help);
			return;
		}
		const output = yield* makeOutput(emit, parsed.heartbeat);
		function report(message: string) {
			if (reported.has(message)) {
				return Effect.void;
			}
			return health(output.emit, "error", { message }).pipe(
				Effect.tap(
					Effect.sync(() => {
						reported.add(message);
					}),
				),
				Effect.andThen(diagnostic(message)),
			);
		}
		yield* polling(parsed.options, parsed.once, output, { error: report, reset: () => reported.clear() });
	});
	yield* run.pipe(
		Effect.tapError((error) =>
			Effect.gen(function* () {
				if (!reported.has(error.message)) {
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
