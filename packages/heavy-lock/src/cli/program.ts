import { Cause, Console, Effect, Queue } from "effect";
import { acquireHeavyLock } from "#acquire.ts";
import { HeavyLockError } from "#error.ts";
import { type CommandLine, runCommand } from "./runCommand.ts";
import { type ForwardedSignal, receiveSignals, signalExitCode } from "./signals.ts";

const FAILED = 1;

type Waited =
	| { readonly _tag: "Held"; readonly env: Readonly<Record<string, string>> }
	| { readonly _tag: "Signalled"; readonly signal: ForwardedSignal };

// A signal while waiting abandons the wait; once the command runs, signals go to the command instead.
function underLock(commandLine: CommandLine) {
	return Effect.scoped(
		Effect.gen(function* () {
			const signals = yield* receiveSignals;
			const waited = yield* Effect.raceFirst(
				Effect.map(acquireHeavyLock({ command: commandLine.join(" ") }), (held): Waited => ({ _tag: "Held", env: held.env })),
				Effect.map(Queue.take(signals), (signal): Waited => ({ _tag: "Signalled", signal })),
			);
			return waited._tag === "Signalled" ? signalExitCode(waited.signal) : yield* runCommand(commandLine, waited.env, signals);
		}),
	);
}

function report(cause: Cause.Cause<unknown>) {
	const error = Cause.squash(cause);
	return Console.error(error instanceof HeavyLockError ? `heavy-lock: ${error.message}` : `heavy-lock: ${Cause.pretty(cause)}`);
}

export function program(commandLine: CommandLine) {
	return underLock(commandLine).pipe(Effect.catchCause((cause) => Effect.as(report(cause), FAILED)));
}
