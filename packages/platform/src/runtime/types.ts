import type { Context, Effect, Exit } from "effect";

export interface PlatformRuntimeOptions {
	/** Reuse one runtime across development module reloads. */
	readonly developmentCacheKey?: string | symbol;
}

export interface PlatformRuntime<Services, BuildError> {
	readonly contextEffect: Effect.Effect<Context.Context<Services>, BuildError>;
	readonly currentServices: () => Context.Context<never> | undefined;
	readonly dispose: () => Promise<void>;
	readonly runPromise: <A, E, Requirements extends Services>(
		effect: Effect.Effect<A, E, Requirements>,
		options?: { readonly signal?: AbortSignal },
	) => Promise<A>;
	readonly runPromiseExit: <A, E, Requirements extends Services>(
		effect: Effect.Effect<A, E, Requirements>,
		options?: { readonly signal?: AbortSignal },
	) => Promise<Exit.Exit<A, E | BuildError>>;
	readonly runWithServices: <Provided, Value>(
		services: Context.Context<Provided>,
		evaluate: () => Value,
	) => Value;
}

export type PlatformRuntimeServices<Runtime> =
	Runtime extends PlatformRuntime<infer Services, infer _BuildError>
		? Services
		: never;

export type PlatformRuntimeBuildError<Runtime> =
	Runtime extends PlatformRuntime<infer _Services, infer BuildError>
		? BuildError
		: never;
