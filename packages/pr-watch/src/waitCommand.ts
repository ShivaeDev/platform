import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { waitOptionsFor } from "#arguments.ts";
import type { Diagnostic } from "#health.ts";
import packageInfo from "#package.json" with { type: "json" };
import { waitFor } from "#waitFor.ts";
import { WaitEnded, type WaitResult } from "#waitResult.ts";

export type Print<E = never, R = never> = (result: WaitResult) => Effect.Effect<void, E, R>;

export function waitCommand<E, R, TDiagnosticError, TDiagnosticRequirements>(
	print: Print<E, R>,
	diagnostic: Diagnostic<TDiagnosticError, TDiagnosticRequirements>,
) {
	return Command.make(
		"wait",
		{
			apiUrl: Flag.String("api-url").pipe(Flag.withDefault("https://api.github.com")),
			number: Argument.Int("PR_NUMBER"),
			repository: Flag.String("repo"),
			stateFile: Flag.String("state").pipe(Flag.optional),
			timeout: Flag.Finite("timeout").pipe(Flag.optional),
		},
		(input) =>
			Effect.gen(function* () {
				const options = yield* Effect.fromResult(
					waitOptionsFor({ ...input, stateFile: Option.getOrUndefined(input.stateFile), timeout: Option.getOrUndefined(input.timeout) }),
				);
				const result = yield* waitFor(options, diagnostic);
				yield* print(result);
				if (result.result !== "passed") {
					return yield* new WaitEnded({ result: result.result });
				}
			}),
	).pipe(Command.withDescription("Wait for one pull request's result, print it as one JSON line and exit with its code"));
}

export const waitProgram = Effect.fn("PrWatch.waitProgram")(function* <E, R, TDiagnosticError, TDiagnosticRequirements>(
	args: readonly string[],
	print: Print<E, R>,
	diagnostic: Diagnostic<TDiagnosticError, TDiagnosticRequirements>,
) {
	yield* Command.runWith(waitCommand(print, diagnostic), { version: packageInfo.version })(args);
});
