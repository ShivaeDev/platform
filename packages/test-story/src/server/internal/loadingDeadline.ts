import { Clock, Effect } from "effect";
import { waitForScreen } from "./waitForScreen.ts";

export const loadingDeadline = Effect.fnUntraced(function* <A>(
	root: () => HTMLElement,
	loading: () => boolean,
	timeout: number,
	loadingTimeout: number,
	expired: () => Effect.Effect<A>,
) {
	const started = yield* Clock.currentTimeMillis;
	yield* Effect.sleep(timeout);
	const remaining = loadingTimeout - ((yield* Clock.currentTimeMillis) - started);
	if (!loading() || remaining <= 0) {
		return yield* expired();
	}
	return yield* waitForScreen(
		{ act: (action) => action(), pending: undefined, root },
		Effect.suspend(() => (loading() ? Effect.fail(undefined) : Effect.void)),
	).pipe(Effect.andThen(expired), Effect.timeoutOrElse({ duration: remaining, orElse: expired }));
});
