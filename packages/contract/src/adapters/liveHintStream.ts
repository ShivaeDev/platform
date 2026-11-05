import { Effect, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { initialize } from "#live-server/initialize.ts";
import { LiveDispatcher } from "./LiveDispatcher.ts";
import { openLiveHints } from "./openLiveHints.ts";

export const liveHintStream = Effect.fn("LiveServer.liveHintStream")(function* (state: Effect.Success<typeof initialize>, keys: readonly Key[]) {
	const reactivity = yield* Reactivity.Reactivity;
	const dispatcher = yield* LiveDispatcher;
	return Stream.unwrap(Effect.map(openLiveHints(state, keys), Stream.succeed)).pipe(
		Stream.provideService(Reactivity.Reactivity, reactivity),
		Stream.provideService(LiveDispatcher, dispatcher),
	);
});
