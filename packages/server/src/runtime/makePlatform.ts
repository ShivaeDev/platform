import { AsyncLocalStorage } from "node:async_hooks";
import type { Layer } from "effect";
import { Cause, Config, Context, Effect, Exit, ManagedRuntime } from "effect";
import type { PlatformRuntime, PlatformRuntimeOptions } from "./types.ts";

const RuntimeCacheKey = Symbol.for("@shivaedev/server/runtime-cache");
const sharedCache: unknown = Reflect.get(globalThis, RuntimeCacheKey);
const runtimeCache: Map<string | symbol, unknown> = sharedCache instanceof Map ? sharedCache : new Map<string | symbol, unknown>();
Reflect.set(globalThis, RuntimeCacheKey, runtimeCache);
// One development cache key belongs to one makePlatformRuntime call site, so its entry has that site's services and build error.
function cachedEntry<TServices, TBuildError>(runtime: unknown): PlatformRuntime<TServices, TBuildError>;
function cachedEntry(runtime: unknown): unknown {
	return runtime;
}
function make<TServices, TBuildError>(layer: Layer.Layer<TServices, TBuildError>): PlatformRuntime<TServices, TBuildError> {
	const managed = ManagedRuntime.make(layer);
	const services = new AsyncLocalStorage<Context.Context<never>>();
	function currentServices() {
		return services.getStore();
	}
	function withAmbient<A, E, TRequirements extends TServices>(
		effect: Effect.Effect<A, E, TRequirements>,
	): Effect.Effect<A, E | TBuildError, TRequirements> {
		const ambient = currentServices();
		return ambient === undefined
			? effect
			: Effect.flatMap(managed.contextEffect, (base) => Effect.provideContext(effect, Context.merge(base, ambient)));
	}
	const runPromiseExit: PlatformRuntime<TServices, TBuildError>["runPromiseExit"] = (effect, options) =>
		managed.runPromiseExit(withAmbient(effect), options);
	const runtime: PlatformRuntime<TServices, TBuildError> = {
		contextEffect: Effect.map(managed.contextEffect, (base) => {
			const ambient = currentServices();
			return ambient === undefined ? base : Context.merge(base, ambient);
		}),
		currentServices,
		dispose: () => managed.dispose(),
		runPromise: async (effect, options) => {
			const exit = await runPromiseExit(effect, options);
			if (Exit.isSuccess(exit)) {
				return exit.value;
			}
			throw Cause.squash(exit.cause);
		},
		runPromiseExit,
		runWithServices: (context, evaluate) => services.run(context, evaluate),
	};
	return runtime;
}
const production = Effect.map(Effect.orDie(Config.String("NODE_ENV").pipe(Config.withDefault(""))), (environment) => environment === "production");
export function makePlatformRuntime<TServices, TBuildError>(
	layer: Layer.Layer<TServices, TBuildError>,
	options: PlatformRuntimeOptions = {},
): PlatformRuntime<TServices, TBuildError> {
	const key = Effect.runSync(production) ? undefined : options.developmentCacheKey;
	if (key === undefined) {
		return make(layer);
	}
	const cached = runtimeCache.get(key);
	if (cached !== undefined) {
		return cachedEntry<TServices, TBuildError>(cached);
	}
	const runtime = make(layer);
	const cachedRuntime: PlatformRuntime<TServices, TBuildError> = {
		...runtime,
		dispose: async () => {
			if (runtimeCache.get(key) === cachedRuntime) {
				runtimeCache.delete(key);
			}
			await runtime.dispose();
		},
	};
	runtimeCache.set(key, cachedRuntime);
	return cachedRuntime;
}
