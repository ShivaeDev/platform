import type { Effect } from "effect";

export type Step = Effect.Effect<unknown, unknown, unknown>;

export type Body<TStep extends Step, A> = () => Generator<TStep, A, never>;
