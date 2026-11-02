import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type { ScreenDriverOptions } from "#screenDriver.ts";

export function screenAct<E>(act: NonNullable<ScreenDriverOptions["act"]>, action: Effect.Effect<void, E>) {
	return Effect.callback<void, E>((resume, signal) => {
		let outcome: Exit.Exit<void, E> = Exit.void;
		const completed = Promise.resolve(
			act(async () => {
				// A rejected callback leaves React's act queue open, so deliver failure after act closes.
				outcome = await Effect.runPromiseExit(action, { signal });
			}),
		);
		completed.then(
			() => resume(Exit.isFailure(outcome) ? Effect.failCause(outcome.cause) : Effect.void),
			(error: unknown) => resume(Effect.die(error)),
		);
		return Effect.promise(() => completed);
	});
}
