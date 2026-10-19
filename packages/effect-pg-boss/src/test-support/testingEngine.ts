import { Deferred, Option, Schema } from "effect";
import type { JobWithMetadata } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { defineQueue } from "#definition.ts";
import type { PgBossService } from "#service.ts";
import { makePgBossTesting, testRetryPolicy } from "#testing.ts";

export function* testingEngine() {
	const attempts: number[] = [];
	const readout: JobWithMetadata<{ readonly id: number }>[] = [];
	return {
		attempts,
		client: Option.none<PgBossClient>(),
		clientCacheKey: Symbol("testing-story"),
		enabled: false,
		entered: yield* Deferred.make<void>(),
		followUps: defineQueue({ name: "testing-story-follow-up", schema: Schema.Struct({ note: Schema.String }) }),
		jobs: Option.none<PgBossService>(),
		paused: false,
		queue: defineQueue({
			name: "testing-story",
			queue: { expireInSeconds: 60, retryBackoff: true, retryDelay: 100, retryDelayMax: 200, retryLimit: 5 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { batchSize: 2, pollingIntervalSeconds: 0.5 },
		}),
		readout,
		recovered: false,
		release: yield* Deferred.make<void>(),
		testing: makePgBossTesting({ retryPolicy: testRetryPolicy }),
		worker: false,
	};
}
