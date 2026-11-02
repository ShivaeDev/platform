import * as Effect from "effect/Effect";

export type Body<TArgs extends readonly unknown[], R, A = unknown> = (
	...args: TArgs
) => Effect.Effect<A, unknown, R> | Generator<Effect.Effect<unknown, unknown, R>, A, never>;

export function effectOf<TArgs extends readonly unknown[], R, A>(body: Body<TArgs, R, A>) {
	return (...args: TArgs): Effect.Effect<A, unknown, R> =>
		Effect.suspend(() => {
			const result = body(...args);
			return Effect.isEffect(result) ? result : Effect.gen(() => result);
		});
}
