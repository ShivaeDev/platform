import { Effect } from "effect";
import type { ConstructorOptions, StopOptions } from "pg-boss";
import { toPgBossError } from "../error.js";
import {
	defaultClientFactory,
	type PgBossClient,
	type PgBossClientFactory,
} from "./client.js";

interface CachedClient {
	readonly client: Promise<PgBossClient>;
	references: number;
}

const CacheKey = Symbol.for("@shivaedev/effect-pg-boss/client-cache");
const globalCache = globalThis as typeof globalThis & {
	[CacheKey]?: Map<string | symbol, CachedClient>;
};
const clientCache =
	globalCache[CacheKey] ?? new Map<string | symbol, CachedClient>();
globalCache[CacheKey] = clientCache;

export interface AcquireClientOptions {
	readonly clientFactory?: PgBossClientFactory;
	readonly constructor: ConstructorOptions;
	readonly developmentCacheKey?: string | symbol;
}

export interface AcquiredClient {
	readonly client: PgBossClient;
	readonly cacheKey?: string | symbol;
	readonly reused: boolean;
}

const startClient = (options: AcquireClientOptions): Promise<PgBossClient> => {
	const client = (options.clientFactory ?? defaultClientFactory)(
		options.constructor,
	);
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

export const acquireClient = (
	options: AcquireClientOptions,
): Effect.Effect<AcquiredClient, import("../error.js").PgBossError> =>
	Effect.tryPromise({
		try: async () => {
			const cacheKey =
				process.env.NODE_ENV === "production"
					? undefined
					: options.developmentCacheKey;
			if (cacheKey === undefined) {
				return {
					client: await startClient(options),
					reused: false,
				};
			}

			const existing = clientCache.get(cacheKey);
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
				if (clientCache.get(cacheKey) === entry) clientCache.delete(cacheKey);
				throw error;
			}
		},
		catch: (error) => toPgBossError("start", error),
	});

export const releaseClient = (
	acquired: AcquiredClient,
	stopOptions?: StopOptions,
): Effect.Effect<void> =>
	Effect.tryPromise({
		try: async () => {
			if (acquired.cacheKey === undefined) {
				await acquired.client.stop(stopOptions);
				return;
			}

			const entry = clientCache.get(acquired.cacheKey);
			if (entry === undefined) return;
			entry.references -= 1;
			if (entry.references > 0) return;
			clientCache.delete(acquired.cacheKey);
			await acquired.client.stop(stopOptions);
		},
		catch: (error) => toPgBossError("stop", error),
	}).pipe(Effect.catch((error) => Effect.logError(error)));
