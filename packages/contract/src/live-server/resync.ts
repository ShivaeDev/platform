import { Effect, Ref } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { initialize } from "#live-server/initialize.ts";

export function resync(state: Effect.Success<typeof initialize>) {
	return Effect.fn("LiveServer.resync")(function* () {
		const reactivity = yield* Reactivity.Reactivity;
		yield* Effect.sync(() => reactivity.invalidateUnsafe([state.resyncKey]));
		return yield* Ref.get(state.openStreams);
	});
}
