import type { Context, Effect, Exit } from "effect";
export interface PlatformRuntimeOptions {
	readonly developmentCacheKey?: string | symbol;
}
export interface PlatformRuntime<TServices, TBuildError> {
	readonly contextEffect: Effect.Effect<Context.Context<TServices>, TBuildError>;
	readonly currentServices: () => Context.Context<never> | undefined;
	readonly dispose: () => Promise<void>;
	readonly runPromise: <A, E, TRequirements extends TServices>(
		effect: Effect.Effect<A, E, TRequirements>,
		options?: {
			readonly signal?: AbortSignal;
		},
	) => Promise<A>;
	readonly runPromiseExit: <A, E, TRequirements extends TServices>(
		effect: Effect.Effect<A, E, TRequirements>,
		options?: {
			readonly signal?: AbortSignal;
		},
	) => Promise<Exit.Exit<A, E | TBuildError>>;
	readonly runWithServices: <TProvided, TValue>(services: Context.Context<TProvided>, evaluate: () => TValue) => TValue;
}
export type PlatformRuntimeServices<TRuntime> = TRuntime extends PlatformRuntime<infer TServices, infer _TBuildError> ? TServices : never;
export type PlatformRuntimeBuildError<TRuntime> = TRuntime extends PlatformRuntime<infer _TServices, infer TBuildError> ? TBuildError : never;
