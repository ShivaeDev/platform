import { AsyncLocalStorage } from "node:async_hooks";
import type { Layer } from "effect";
import { Cause, Context, Effect, Exit, ManagedRuntime } from "effect";
import type { PlatformRuntime, PlatformRuntimeOptions } from "./types.js";

const RuntimeCacheKey = Symbol.for("@shivaedev/platform/runtime-cache");
const globalRuntimeCache = globalThis as typeof globalThis & {
	[RuntimeCacheKey]?: Map<string | symbol, PlatformRuntime<unknown, unknown>>;
};
const runtimeCache =
	globalRuntimeCache[RuntimeCacheKey] ??
	new Map<string | symbol, PlatformRuntime<unknown, unknown>>();
globalRuntimeCache[RuntimeCacheKey] = runtimeCache;

const make = <Services, BuildError>(
	layer: Layer.Layer<Services, BuildError>,
): PlatformRuntime<Services, BuildError> => {
	const managed = ManagedRuntime.make(layer);
	const services = new AsyncLocalStorage<Context.Context<never>>();

	const currentServices = () => services.getStore();
	const withAmbient = <A, E, Requirements extends Services>(
		effect: Effect.Effect<A, E, Requirements>,
	): Effect.Effect<A, E | BuildError, Requirements> => {
		const ambient = currentServices();
		return ambient === undefined
			? effect
			: Effect.flatMap(managed.contextEffect, (base) =>
					Effect.provideContext(effect, Context.merge(base, ambient)),
				);
	};

	const runPromiseExit: PlatformRuntime<
		Services,
		BuildError
	>["runPromiseExit"] = (effect, options) =>
		managed.runPromiseExit(withAmbient(effect), options);

	const runtime: PlatformRuntime<Services, BuildError> = {
		contextEffect: Effect.map(managed.contextEffect, (base) => {
			const ambient = currentServices();
			return ambient === undefined ? base : Context.merge(base, ambient);
		}),
		currentServices,
		dispose: () => managed.dispose(),
		runPromise: async (effect, options) => {
			const exit = await runPromiseExit(effect, options);
			if (Exit.isSuccess(exit)) return exit.value;
			throw Cause.squash(exit.cause);
		},
		runPromiseExit,
		runWithServices: (context, evaluate) =>
			services.run(context as Context.Context<never>, evaluate),
	};

	return runtime;
};

export const makePlatformRuntime = <Services, BuildError>(
	layer: Layer.Layer<Services, BuildError>,
	options: PlatformRuntimeOptions = {},
): PlatformRuntime<Services, BuildError> => {
	const key =
		process.env.NODE_ENV === "production"
			? undefined
			: options.developmentCacheKey;
	if (key === undefined) return make(layer);

	const cached = runtimeCache.get(key);
	if (cached !== undefined) {
		return cached as PlatformRuntime<Services, BuildError>;
	}

	const runtime = make(layer);
	const cachedRuntime: PlatformRuntime<Services, BuildError> = {
		...runtime,
		dispose: async () => {
			if (runtimeCache.get(key) === cachedRuntime) runtimeCache.delete(key);
			await runtime.dispose();
		},
	};
	runtimeCache.set(key, cachedRuntime as PlatformRuntime<unknown, unknown>);
	return cachedRuntime;
};
