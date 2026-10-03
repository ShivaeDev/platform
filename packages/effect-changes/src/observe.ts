import { Effect } from "effect";

export type Observation<A> =
	| { readonly _tag: "Recorded"; readonly changes: readonly A[] }
	| { readonly _tag: "Published"; readonly changes: readonly A[] }
	| { readonly _tag: "Discarded"; readonly changes: readonly A[] };

export type Observer<A> = (observation: Observation<A>) => Effect.Effect<void>;

export const unobserved = (_observation: unknown): Effect.Effect<void> => Effect.void;
