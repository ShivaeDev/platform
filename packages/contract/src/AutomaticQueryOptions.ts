import type { Duration } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { LiveBound, LiveConnection } from "#automaticLive.ts";
import type { LiveStatus } from "#live.ts";
import type { QuerySignals } from "#querySignals.ts";

export interface AutomaticQueryOptions<A, E> {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly clientStatuses: Atom.Writable<ReadonlyMap<object, LiveStatus<unknown>>> | undefined;
	readonly coalesceWindow: Atom.Writable<Duration.Input>;
	readonly equivalent: (left: A, right: A) => boolean;
	readonly paused: Atom.Writable<boolean>;
	readonly pushed: boolean;
	readonly ready: Atom.Writable<boolean>;
	readonly resultVersion: Atom.Atom<number>;
	readonly signals: Atom.Writable<QuerySignals>;
	readonly source: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly statuses: Atom.Writable<ReadonlyMap<object, LiveStatus<unknown>>>;
	readonly subscription: LiveBound[typeof LiveConnection];
	readonly subscriptionVersion: Atom.Atom<number>;
}
