import { type Context, Effect, Exit, Scope } from "effect";
import type { PgBossClient } from "#server/client.ts";
import type { StopOptions } from "#server/clientOptions.ts";
import { PgBossClientOptionsError, toPgBossError } from "#server/error.ts";
import { observeClientErrors } from "#server/internal/clientErrors.ts";
import { jobStorePlans } from "#server/internal/jobStorePlans.ts";
import type { AcquireClientOptions, ClientEngine } from "#server/internal/lifecycle.ts";
import { acquireCachedClient, releaseCachedClient } from "./clientCache.ts";
import { defaultClientFactory } from "./defaultClientFactory.ts";

export interface StartingClient {
	readonly client: PgBossClient;
	readonly ready: Promise<void>;
	readonly stop: (options?: StopOptions) => Promise<void>;
}

function startClient(options: AcquireClientOptions, report: (error: Error) => void): StartingClient {
	const client = (options.clientFactory ?? defaultClientFactory)(options.constructor);
	observeClientErrors(client, report);
	let closing = false;
	const ready = (async () => {
		await client.start();
		if (!closing && options.constructor.migrate !== false && client.getDb !== undefined) {
			for (const plan of jobStorePlans(options.constructor.schema ?? "pgboss")) {
				await client.getDb().executeSql(plan);
			}
		}
	})();
	return {
		client,
		ready,
		stop: (settings) => {
			closing = true;
			return client.stop(settings);
		},
	};
}

const acquire = Effect.fnUntraced(function* (options: AcquireClientOptions, report: (error: Error) => void, stop?: StopOptions) {
	const scope = yield* Scope.fork(yield* Scope.Scope);
	return yield* Effect.gen(function* () {
		const lease = yield* Effect.acquireRelease(
			Effect.try({
				catch: (error) => (error instanceof PgBossClientOptionsError ? error : toPgBossError("start", error)),
				try: () =>
					options.clientCacheKey === undefined
						? { ...startClient(options, report), reused: false }
						: acquireCachedClient(options.clientCacheKey, options.constructor, () => startClient(options, report)),
			}),
			(acquired) =>
				Effect.tryPromise({
					catch: (error) => toPgBossError("stop", error),
					try: async () => {
						const client = options.clientCacheKey === undefined ? acquired : releaseCachedClient(options.clientCacheKey);
						await client?.stop(stop);
					},
				}).pipe(Effect.catch(Effect.logError)),
		);
		yield* Effect.tryPromise({ catch: (error) => toPgBossError("start", error), try: () => lease.ready });
		return { ...(options.clientCacheKey === undefined ? {} : { cacheKey: options.clientCacheKey }), client: lease.client, reused: lease.reused };
	}).pipe(
		Effect.provideService(Scope.Scope, scope),
		Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause))),
	);
});

export const clientEngine: Context.Service.Shape<typeof ClientEngine> = { acquire };
