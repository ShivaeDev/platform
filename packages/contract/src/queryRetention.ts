import type { Duration } from "effect";
import * as Atom from "effect/reactivity/Atom";

export interface QueryRetentionOptions {
	readonly capacity?: number;
	readonly storedBytes?: number;
	readonly timeToLive?: Duration.Input;
}

export const queryRetention = Atom.keepAlive(Atom.make<QueryRetentionOptions>({}));
