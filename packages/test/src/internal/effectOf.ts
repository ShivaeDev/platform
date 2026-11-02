import * as Effect from "effect/Effect";

export type Body<TArgs extends readonly unknown[], R> = (
	...args: TArgs
) => Effect.Effect<unknown, unknown, R> | Generator<Effect.Effect<unknown, unknown, R>, unknown, never>;

export function effectOf<TArgs extends readonly unknown[], R>(body: Body<TArgs, R>) {
	return (...args: TArgs): Effect.Effect<unknown, unknown, R> =>
		Effect.suspend(() => {
			const result = body(...args);
			return Effect.isEffect(result) ? result : Effect.gen(() => result);
		});
}
