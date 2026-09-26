import { Effect } from "effect";

export type Observation<A> =
	| { readonly _tag: "Recorded"; readonly changes: ReadonlyArray<A> }
	| { readonly _tag: "Published"; readonly changes: ReadonlyArray<A> }
	| { readonly _tag: "Discarded"; readonly changes: ReadonlyArray<A> };

export type Observer<A> = (observation: Observation<A>) => Effect.Effect<void>;

export const unobserved = (_observation: unknown): Effect.Effect<void> => Effect.void;
