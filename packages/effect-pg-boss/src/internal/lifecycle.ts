import { Effect } from "effect";
import type { ConstructorOptions, StopOptions } from "pg-boss";
import { toPgBossError } from "../error.ts";
import { defaultClientFactory, type PgBossClient, type PgBossClientFactory } from "./client.ts";

interface CachedClient {
	readonly client: Promise<PgBossClient>;
	references: number;
}

const CacheKey = Symbol.for("@shivaedev/effect-pg-boss/client-cache");
const sharedCache: unknown = Reflect.get(globalThis, CacheKey);
const clientCache: Map<string | symbol, unknown> = sharedCache instanceof Map ? sharedCache : new Map<string | symbol, unknown>();
Reflect.set(globalThis, CacheKey, clientCache);

const isCachedClient = (value: unknown): value is CachedClient =>
	typeof value === "object"
	&& value !== null
	&& Reflect.get(value, "client") instanceof Promise
	&& typeof Reflect.get(value, "references") === "number";

const cachedClient = (key: string | symbol): CachedClient | undefined => {
	const entry = clientCache.get(key);
	return isCachedClient(entry) ? entry : undefined;
};

export interface AcquireClientOptions {
	readonly clientCacheKey?: string | symbol | undefined;
	readonly clientFactory?: PgBossClientFactory | undefined;
	readonly constructor: ConstructorOptions;
}

export interface AcquiredClient {
	readonly cacheKey?: string | symbol;
	readonly client: PgBossClient;
	readonly reused: boolean;
}

const startClient = (options: AcquireClientOptions): Promise<PgBossClient> => {
	const client = (options.clientFactory ?? defaultClientFactory)(options.constructor);
	return client.start().then(
		() => client,
		async (error) => {
			try {
				await client.stop();
			} catch {
				// Preserve the startup failure; stop is best effort on failed acquisition.
			}
			throw error;
		},
	);
};

export const acquireClient = (options: AcquireClientOptions): Effect.Effect<AcquiredClient, import("../error.ts").PgBossError> =>
	Effect.tryPromise({
		catch: (error) => toPgBossError("start", error),
		try: async () => {
			const cacheKey = options.clientCacheKey;
			if (cacheKey === undefined) {
				return {
					client: await startClient(options),
					reused: false,
				};
			}

			const existing = cachedClient(cacheKey);
			if (existing !== undefined) {
				existing.references += 1;
				try {
					return {
						cacheKey,
						client: await existing.client,
						reused: true,
					};
				} catch (error) {
					existing.references -= 1;
					throw error;
				}
			}

			const entry: CachedClient = {
				client: startClient(options),
				references: 1,
			};
			clientCache.set(cacheKey, entry);
			try {
				return {
					cacheKey,
					client: await entry.client,
					reused: false,
				};
			} catch (error) {
				if (clientCache.get(cacheKey) === entry) {
					clientCache.delete(cacheKey);
				}
				throw error;
			}
		},
	});

export const releaseClient = (acquired: AcquiredClient, stopOptions?: StopOptions): Effect.Effect<void> =>
	Effect.tryPromise({
		catch: (error) => toPgBossError("stop", error),
		try: async () => {
			if (acquired.cacheKey === undefined) {
				await acquired.client.stop(stopOptions);
				return;
			}

			const entry = cachedClient(acquired.cacheKey);
			if (entry === undefined) {
				return;
			}
			entry.references -= 1;
			if (entry.references > 0) {
				return;
			}
			clientCache.delete(acquired.cacheKey);
			await acquired.client.stop(stopOptions);
		},
	}).pipe(Effect.catch((error) => Effect.logError(error)));
