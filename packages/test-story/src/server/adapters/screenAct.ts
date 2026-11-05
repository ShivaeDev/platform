import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type { ScreenDriverOptions } from "#server/screenDriver.ts";

export function screenAct<E, A = void>(act: NonNullable<ScreenDriverOptions["act"]>, action: Effect.Effect<A, E>) {
	return Effect.callback<A, E>((resume, signal) => {
		let outcome: Exit.Exit<A, E>;
		const completed = Promise.resolve(
			act(async () => {
				// A rejected callback leaves React's act queue open, so deliver failure after act closes.
				outcome = await Effect.runPromiseExit(action, { signal });
			}),
		);
		completed.then(
			() => resume(Exit.isFailure(outcome) ? Effect.failCause(outcome.cause) : Effect.succeed(outcome.value)),
			(error: unknown) => resume(Effect.die(error)),
		);
		return Effect.promise(() => completed);
	});
}

export const directScreenAct: NonNullable<ScreenDriverOptions["act"]> = (action) => action();

export function screenPerform(act: NonNullable<ScreenDriverOptions["act"]>, tell: (line: string) => void) {
	return (line: string, action: () => void) =>
		Effect.promise(async () => {
			tell(line);
			await act(async () => action());
		});
}
