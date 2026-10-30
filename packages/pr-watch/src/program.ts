import { Effect, Exit, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { optionsFor } from "#arguments.ts";
import { type Emit, health, makeOutput } from "#health.ts";
import type { Options } from "#model.ts";
import packageInfo from "#package.json" with { type: "json" };
import { polling } from "#polling.ts";
import { requestFailure } from "#requestFailure.ts";

export function watchCommand(emit: Emit, diagnostic: Emit) {
	return Command.make(
		"pr-watch",
		{
			apiUrl: Flag.String("api-url").pipe(Flag.withDefault("https://api.github.com")),
			events: Flag.String("events").pipe(Flag.optional),
			fleet: Flag.Boolean("fleet").pipe(Flag.withDefault(false)),
			heartbeat: Flag.Finite("heartbeat").pipe(Flag.withDefault(900)),
			interval: Flag.Finite("interval").pipe(Flag.withDefault(60)),
			numbers: Argument.Int("PR_NUMBER").pipe(Argument.variadic()),
			once: Flag.Boolean("once").pipe(Flag.withDefault(false)),
			repository: Flag.String("repo"),
			stateFile: Flag.String("state").pipe(Flag.optional),
		},
		(input) =>
			Effect.gen(function* () {
				const parsed = yield* optionsFor({
					...input,
					events: Option.getOrUndefined(input.events),
					stateFile: Option.getOrUndefined(input.stateFile),
				}).pipe(
					Effect.tapError((error) =>
						health(emit, "error", { errorTag: error instanceof Error ? error.name : "UnknownFailure", message: error.message }).pipe(
							Effect.andThen(health(emit, "stopped", { reason: "failed" })),
						),
					),
				);
				yield* watch(parsed.options, parsed, emit, diagnostic);
			}),
	);
}

export const program = Effect.fn("PrWatch.program")(function* (args: readonly string[], emit: Emit, diagnostic: Emit) {
	yield* Command.runWith(watchCommand(emit, diagnostic), { version: packageInfo.version })(args);
});

export const watch = Effect.fn("PrWatch.watch")(function* (
	options: Options,
	settings: { readonly heartbeat: number; readonly once: boolean },
	emit: Emit,
	diagnostic: Emit,
) {
	const reported = new Set<unknown>();
	const run = Effect.gen(function* () {
		const output = yield* makeOutput(emit, settings.heartbeat);
		function report(failure: unknown) {
			const { message } = requestFailure(failure);
			if (reported.has(failure)) {
				return Effect.void;
			}
			return health(output.emit, "error", { errorTag: failure instanceof Error ? failure.name : "UnknownFailure", message }).pipe(
				Effect.tap(
					Effect.sync(() => {
						reported.add(failure);
					}),
				),
				Effect.andThen(diagnostic(message)),
			);
		}
		yield* polling(options, settings.once, output, { error: report, reset: () => reported.clear() });
	});
	yield* run.pipe(
		Effect.tapError((failure) =>
			Effect.gen(function* () {
				const error = requestFailure(failure);
				if (!reported.has(failure)) {
					yield* health(emit, "error", { errorTag: failure instanceof Error ? failure.name : "UnknownFailure", message: error.message });
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
