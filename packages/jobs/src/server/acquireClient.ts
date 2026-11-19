import { Effect, Redacted } from "effect";
import { clientErrorLogger } from "#server/adapters/clientErrorLogger.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { ClientEngine } from "#server/lifecycle.ts";
import type { PgBossOptions } from "#server/service.ts";

export const acquireClient = Effect.fnUntraced(function* (options: PgBossOptions) {
	const { connectionString, clientCacheKey, stop, ...settings } = options;
	const constructorOptions = {
		...settings,
		idleTimeoutMillis: settings.idleTimeoutMillis ?? 60_000,
		maxLifetimeSeconds: settings.maxLifetimeSeconds ?? 600,
		...(connectionString === undefined ? {} : { connectionString: Redacted.value(connectionString) }),
	};
	const report = yield* clientErrorLogger();
	const engine = yield* ClientEngine;
	const clientFactory = yield* JobsClientFactory;
	const acquired = yield* engine.acquire(
		{
			clientCacheKey,
			clientFactory,
			constructor: constructorOptions,
		},
		report,
		stop,
	);
	return { ...acquired, schema: settings.schema, stop };
});
