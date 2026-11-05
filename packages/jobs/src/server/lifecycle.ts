import { Context, type Effect, type Scope } from "effect";
import type { PgBossClient, PgBossClientFactory } from "#server/client.ts";
import type { ClientOptions, StopOptions } from "#server/clientOptions.ts";
import type { PgBossClientOptionsError, PgBossError } from "#server/error.ts";

export interface AcquireClientOptions {
	readonly clientCacheKey?: string | symbol | undefined;
	readonly clientFactory?: PgBossClientFactory | undefined;
	readonly constructor: ClientOptions;
}

export interface AcquiredClient {
	readonly cacheKey?: string | symbol;
	readonly client: PgBossClient;
	readonly reused: boolean;
}

export class ClientEngine extends Context.Service<
	ClientEngine,
	{
		readonly acquire: (
			options: AcquireClientOptions,
			report: (error: Error) => void,
			stop?: StopOptions,
		) => Effect.Effect<AcquiredClient, PgBossError | PgBossClientOptionsError, Scope.Scope>;
	}
>()("@shivaedev/jobs/ClientEngine") {}
