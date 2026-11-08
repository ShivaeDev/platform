import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

export type ScreenAct = (action: () => Promise<void>) => PromiseLike<void>;

export function screenAct<E, A = void>(act: ScreenAct, action: Effect.Effect<A, E>) {
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

export const directScreenAct: ScreenAct = (action) => action();

export function screenPerform(act: ScreenAct, tell: (line: string) => void) {
	return (line: string, action: () => void) =>
		Effect.promise(async () => {
			tell(line);
			await act(async () => action());
		});
}
