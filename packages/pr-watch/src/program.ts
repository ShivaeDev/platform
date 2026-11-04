import { Effect, Exit, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { optionsFor } from "#arguments.ts";
import { type Diagnostic, type Emit, health, makeOutput } from "#health.ts";
import type { Options } from "#model.ts";
import packageInfo from "#package.json" with { type: "json" };
import { polling } from "#polling.ts";
import { requestFailure } from "#requestFailure.ts";

export function watchCommand<E, R, TDiagnosticError, TDiagnosticRequirements>(
	emit: Emit<E, R>,
	diagnostic: Diagnostic<TDiagnosticError, TDiagnosticRequirements>,
) {
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
				const parsed = yield* Effect.fromResult(
					optionsFor({
						...input,
						events: Option.getOrUndefined(input.events),
						stateFile: Option.getOrUndefined(input.stateFile),
					}),
				).pipe(
					Effect.tapError((error) =>
						health(emit, { errorTag: error instanceof Error ? error.name : "UnknownFailure", event: "error", message: error.message }).pipe(
							Effect.andThen(health(emit, { event: "stopped", reason: "failed" })),
						),
					),
				);
				yield* watch(parsed.options, parsed, emit, diagnostic);
			}),
	);
}

export const program = Effect.fn("PrWatch.program")(function* <E, R, TDiagnosticError, TDiagnosticRequirements>(
	args: readonly string[],
	emit: Emit<E, R>,
	diagnostic: Diagnostic<TDiagnosticError, TDiagnosticRequirements>,
) {
	yield* Command.runWith(watchCommand(emit, diagnostic), { version: packageInfo.version })(args);
});

export const watch = Effect.fn("PrWatch.watch")(function* <E, R, TDiagnosticError, TDiagnosticRequirements>(
	options: Options,
	settings: { readonly heartbeat: number; readonly once: boolean },
	emit: Emit<E, R>,
	diagnostic: Diagnostic<TDiagnosticError, TDiagnosticRequirements>,
) {
	const reported = new Set<unknown>();
	const run = Effect.gen(function* () {
		const output = yield* makeOutput(emit, settings.heartbeat);
		function report(failure: unknown) {
			const { message } = requestFailure(failure);
			if (reported.has(failure)) {
				return Effect.void;
			}
			return health(output.emit, { errorTag: failure instanceof Error ? failure.name : "UnknownFailure", event: "error", message }).pipe(
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
					yield* health(emit, { errorTag: failure instanceof Error ? failure.name : "UnknownFailure", event: "error", message: error.message });
				}
				if (error.retryAt !== undefined) {
					yield* health(emit, { event: "cooldown", message: error.message, nextPollAt: new Date(error.retryAt).toISOString() });
				}
			}),
		),
		Effect.onExit((exit) => {
			let reason: "completed" | "interrupted" | "failed" = "completed";
			if (exit._tag === "Failure") {
				reason = Exit.hasInterrupts(exit) ? "interrupted" : "failed";
			}
			return health(emit, { event: "stopped", reason });
		}),
	);
});
