import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type { ScreenDriverOptions } from "#screenDriver.ts";

export function screenAct(act: NonNullable<ScreenDriverOptions["act"]>, action: Effect.Effect<void>) {
	return Effect.callback<void>((resume, signal) => {
		let outcome: Exit.Exit<void> = Exit.void;
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
