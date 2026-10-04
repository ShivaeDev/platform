import { Cause, Console, Effect, Option, Queue } from "effect";
import { acquireHeavyLock } from "#acquire.ts";
import { HeavyLockError } from "#error.ts";
import { type CommandLine, parseCommandLine, USAGE } from "./args.ts";
import { runCommand } from "./run-command.ts";
import { type ForwardedSignal, receiveSignals, signalExitCode } from "./signals.ts";

const USAGE_ERROR = 2;
const FAILED = 1;

type Waited =
	| { readonly _tag: "Held"; readonly env: Readonly<Record<string, string>> }
	| { readonly _tag: "Signalled"; readonly signal: ForwardedSignal };

// A signal while waiting abandons the wait; once the command runs, signals go to the command instead.
const underLock = (commandLine: CommandLine) =>
	Effect.scoped(
		Effect.gen(function* () {
			const signals = yield* receiveSignals;
			const waited = yield* Effect.raceFirst(
				Effect.map(acquireHeavyLock({ command: commandLine.join(" ") }), (held): Waited => ({ _tag: "Held", env: held.env })),
				Effect.map(Queue.take(signals), (signal): Waited => ({ _tag: "Signalled", signal })),
			);
			return waited._tag === "Signalled" ? signalExitCode(waited.signal) : yield* runCommand(commandLine, waited.env, signals);
		}),
	);

const report = (cause: Cause.Cause<unknown>) => {
	const error = Cause.squash(cause);
	return Console.error(error instanceof HeavyLockError ? `heavy-lock: ${error.message}` : `heavy-lock: ${Cause.pretty(cause)}`);
};

export const program = (args: readonly string[]) => {
	const commandLine = parseCommandLine(args);
	if (Option.isNone(commandLine)) {
		return Effect.as(Console.error(USAGE), USAGE_ERROR);
	}
	return underLock(commandLine.value).pipe(Effect.catchCause((cause) => Effect.as(report(cause), FAILED)));
};
