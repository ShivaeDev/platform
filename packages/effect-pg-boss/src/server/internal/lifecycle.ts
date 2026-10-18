import { Effect } from "effect";
import type { ConstructorOptions, StopOptions } from "pg-boss";
import { defaultClientFactory, type PgBossClient, type PgBossClientFactory } from "#client.ts";
import { toPgBossError } from "#error.ts";
import { deferralStorePlan } from "#internal/deferralStorePlan.ts";
import { acquireCachedClient, releaseCachedClient } from "./clientCache.ts";
import { logClientError, observeClientErrors } from "./clientErrors.ts";

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

async function startClient(options: AcquireClientOptions, report: (error: Error) => void): Promise<PgBossClient> {
	const client = (options.clientFactory ?? defaultClientFactory)(options.constructor);
	observeClientErrors(client, report);
	try {
		await client.start();
		if (options.constructor.migrate !== false && client.getDb !== undefined) {
			await client.getDb().executeSql(deferralStorePlan(options.constructor.schema ?? "pgboss"));
		}
		return client;
	} catch (error) {
		try {
			await client.stop();
		} catch {
			// Preserve the startup failure; stop is best effort on failed acquisition.
		}
		throw error;
	}
}

export function acquireClient(options: AcquireClientOptions): Effect.Effect<AcquiredClient, import("#error.ts").PgBossError> {
	return Effect.contextWith((context) => {
		const run = Effect.runForkWith(context);
		function report(error: Error) {
			run(logClientError(error));
		}
		return Effect.tryPromise({
			catch: (error) => toPgBossError("start", error),
			try: async () => {
				const cacheKey = options.clientCacheKey;
				return cacheKey === undefined
					? { client: await startClient(options, report), reused: false }
					: { cacheKey, ...(await acquireCachedClient(cacheKey, () => startClient(options, report))) };
			},
		});
	});
}

export function releaseClient(acquired: AcquiredClient, stopOptions?: StopOptions): Effect.Effect<void> {
	return Effect.tryPromise({
		catch: (error) => toPgBossError("stop", error),
		try: async () => {
			const client = acquired.cacheKey === undefined ? acquired.client : await releaseCachedClient(acquired.cacheKey);
			if (client !== undefined) {
				await client.stop(stopOptions);
			}
		},
	}).pipe(Effect.catch((error) => Effect.logError(error)));
}
