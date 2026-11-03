import type { Cause, Effect, SubscriptionRef } from "effect";

export type State<E> =
	| { readonly status: "running" }
	| { readonly status: "waiting"; readonly nextDue: number | undefined }
	| { readonly status: "failed"; readonly cause: Cause.Cause<E> };

export interface Reconciler<E> {
	readonly await: Effect.Effect<void, E>;
	readonly refresh: Effect.Effect<void>;
	readonly resume: Effect.Effect<void>;
	readonly state: SubscriptionRef.SubscriptionRef<State<E>>;
}

export type Due<TValue> = (value: TValue, now: number) => number | undefined;
