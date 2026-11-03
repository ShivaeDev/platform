import type { Effect } from "effect";

export interface Process<A, E> {
	readonly exited: Effect.Effect<number, E>;
	readonly pid: number;
	readonly ready: Effect.Effect<A, E>;
}
