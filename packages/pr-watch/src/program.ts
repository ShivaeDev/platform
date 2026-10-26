import { Effect, Exit } from "effect";
import { argumentsFor, help } from "#arguments.ts";
import { type Emit, health, makeOutput } from "#health.ts";
import type { Options, WatchError } from "#model.ts";
import { polling } from "#polling.ts";

export const program = Effect.fn("PrWatch.program")(function* (
	args: readonly string[],
	emit: Emit,
	diagnostic: (message: string) => Effect.Effect<void, WatchError>,
) {
	const parsed = yield* argumentsFor(args).pipe(
		Effect.tapError((error) => health(emit, "error", { message: error.message }).pipe(Effect.andThen(health(emit, "stopped", { reason: "failed" })))),
	);
	if (parsed.help) {
		yield* emit(help);
		return;
	}
	yield* watch(parsed.options, { heartbeat: parsed.heartbeat, once: parsed.once }, emit, diagnostic);
});

export const watch = Effect.fn("PrWatch.watch")(function* (
	options: Options,
	settings: { readonly heartbeat: number; readonly once: boolean },
	emit: Emit,
	diagnostic: Emit,
) {
	const reported = new Set<string>();
	const run = Effect.gen(function* () {
		const output = yield* makeOutput(emit, settings.heartbeat);
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
		yield* polling(options, settings.once, output, { error: report, reset: () => reported.clear() });
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
			let reason = "completed";
			if (exit._tag === "Failure") {
				reason = Exit.hasInterrupts(exit) ? "interrupted" : "failed";
			}
			return health(emit, "stopped", { reason }).pipe(Effect.orDie);
		}),
	);
});
