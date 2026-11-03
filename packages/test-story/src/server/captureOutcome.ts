import { Cause, Effect, Exit, Option } from "effect";

interface Renderers<A, E, TSuccess, TFailure, TDefect, TInterrupt> {
	readonly onDefect: (defect: unknown, cause: Cause.Cause<E>) => TDefect;
	readonly onFailure: (error: E) => TFailure;
	readonly onInterrupt: () => TInterrupt;
	readonly onSuccess: (value: A) => TSuccess;
}

export function renderOutcome<A, E, TSuccess, TFailure, TDefect, TInterrupt>(
	exit: Exit.Exit<A, E>,
	renderers: Renderers<A, E, TSuccess, TFailure, TDefect, TInterrupt>,
): TSuccess | TFailure | TDefect | TInterrupt {
	if (Exit.isSuccess(exit)) {
		return renderers.onSuccess(exit.value);
	}
	const failure = Cause.findErrorOption(exit.cause);
	if (Option.isSome(failure)) {
		return renderers.onFailure(failure.value);
	}
	return Cause.hasInterruptsOnly(exit.cause) ? renderers.onInterrupt() : renderers.onDefect(Cause.squash(exit.cause), exit.cause);
}

export function captureOutcome<A, E, R, TSuccess, TFailure, TDefect, TInterrupt>(
	effect: Effect.Effect<A, E, R>,
	renderers: Renderers<A, E, TSuccess, TFailure, TDefect, TInterrupt>,
): Effect.Effect<TSuccess | TFailure | TDefect | TInterrupt, never, R> {
	return Effect.map(Effect.exit(effect), (exit) => renderOutcome(exit, renderers));
}
