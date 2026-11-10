import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";

export interface ScreenSignalState {
	readonly pending: boolean;
}

export type ScreenSignal = Stream.Stream<ScreenSignalState> & { readonly current: Effect.Effect<ScreenSignalState> };
