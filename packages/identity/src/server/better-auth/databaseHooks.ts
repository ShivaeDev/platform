import type { BetterAuthOptions } from "better-auth";
import type { Effect } from "effect";

export interface BetterAuthHookError {
	readonly code: string;
	readonly message: string;
}

type EffectHooks<T, R> = {
	readonly [TKey in keyof T]: NonNullable<T[TKey]> extends (...args: infer TArgs) => infer TResult
		? (...args: TArgs) => Effect.Effect<Awaited<TResult>, BetterAuthHookError, R>
		: EffectHooks<NonNullable<T[TKey]>, R>;
};

export type BetterAuthDatabaseHooks<R = never> = EffectHooks<NonNullable<BetterAuthOptions["databaseHooks"]>, R>;
