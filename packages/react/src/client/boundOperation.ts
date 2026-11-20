import type { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type { AtomServices } from "#AtomServices.ts";

// A bound contract command fits as it is. Any other Effect becomes one by naming the runtime that provides its services.
export interface BoundOperation<TInput, A, E, R, TRuntimeError> {
	// A bound query also has `run` and `runtime`; this property turns passing one into an error that says why.
	readonly query?: "a bound query only reads: read it with useQuery, and pass a command here";
	readonly run: (input: TInput) => Effect.Effect<A, E, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<R, TRuntimeError>;
}

export type LooseOperation = BoundOperation<object, unknown, unknown, unknown, unknown> & { readonly payload?: unknown };
