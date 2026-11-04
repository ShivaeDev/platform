import type { Effect, Schema } from "effect";
import type { Reactivity } from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";

export type ProjectionServices = SqlClient.SqlClient | Reactivity;

export interface StoredEvent {
	readonly payload: unknown;
	readonly version: number;
}

export interface Event<A> {
	readonly requestId: string;
	readonly stream: string;
	readonly streamVersion: number;
	readonly value: A;
}

export interface Projection<A, E> {
	readonly apply: (event: Event<A>) => Effect.Effect<void, E, ProjectionServices>;
	readonly name: string;
	readonly reset: Effect.Effect<void, E, ProjectionServices>;
}

export interface EventStoreOptions<A, E, TUpcastError> {
	readonly name: string;
	readonly projections: readonly Projection<A, E>[];
	readonly schema: Schema.Codec<A, unknown>;
	readonly upcast?: (event: StoredEvent) => Effect.Effect<unknown, TUpcastError>;
	readonly version: number;
}

export interface Append<A> {
	readonly events: readonly A[];
	readonly expectedVersion: number;
	readonly requestId: string;
	readonly stream: string;
}
