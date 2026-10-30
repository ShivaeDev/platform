import { Effect } from "effect";

export type Body<A, E, R> = Effect.Effect<A, E, R> | (() => Generator<Effect.Effect<unknown, E, R>, A, never>);

export function effectOf<A, E, R>(body: Body<A, E, R>): Effect.Effect<A, E, R> {
	return Effect.isEffect(body) ? body : Effect.gen(body);
}
