import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import type { ScreenDriverOptions } from "#server/screenDriver.ts";

export const observeScreen = Effect.fnUntraced(function* (
	options: { readonly [TKey in "pending" | "activity" | "transport"]?: ScreenDriverOptions[TKey] | undefined },
	changes: Queue.Queue<void>,
) {
	const sources = [options.pending, options.activity, options.transport];
	const samples: Effect.Effect<boolean>[] = [];
	for (const source of sources) {
		if (source === undefined) {
			continue;
		}
		if (typeof source === "function") {
			samples.push(Effect.sync(source));
			continue;
		}
		let busy = true;
		const states = "current" in source ? Stream.map(source, (state) => state.pending) : source;
		yield* states.pipe(
			Stream.runForEach((value) =>
				Effect.sync(() => {
					busy = value;
					Queue.offerUnsafe(changes, undefined);
				}),
			),
			Effect.forkScoped({ startImmediately: true }),
		);
		samples.push("current" in source ? Effect.map(source.current, (state) => state.pending) : Effect.sync(() => busy));
	}
	return Effect.map(Effect.all(samples), (states) => states.some(Boolean));
});
