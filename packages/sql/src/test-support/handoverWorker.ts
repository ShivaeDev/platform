import { Config, type Context, Deferred, Effect, Layer, Schema, type Scope } from "effect";
import type { PgBossClient } from "@shivaedev/jobs/server/client.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { WorkerRelease } from "#WorkerRelease.ts";

export const handoverWorker = Effect.fnUntraced(function* (
	name: string,
	schema: string,
	scope: Scope.Scope,
	release: Context.Service.Shape<typeof WorkerRelease>,
	draining: Deferred.Deferred<void>,
	drained: Deferred.Deferred<void>,
	timeline: string[],
) {
	const connectionString = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
	const testing = makePgBossTesting();
	const started = yield* Deferred.make<void>();
	const queue = defineQueue({ name: "handover", schema: Schema.Struct({ hold: Schema.Boolean }), worker: { pollingIntervalSeconds: 0.5 } });
	const Jobs = makePgBoss(`handover/${name}`);
	let client: PgBossClient | undefined;
	const layer = Jobs.layer({
		jobs: [queue.handle(({ hold }) => (hold ? Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(drained))) : Effect.void))],
	}).pipe(
		Layer.provide(Layer.succeed(WorkerRelease, release)),
		Layer.provide(
			pgBossLayer({
				clientFactory: (options) => {
					client = testing.clientFactory(options);
					const offWork = client.offWork.bind(client);
					const observed: PgBossClient["offWork"] = async (...args) => {
						const working = (client?.getWipData?.().length ?? 0) > 0;
						Deferred.doneUnsafe(draining, Effect.void);
						await offWork(...args);
						if (working) {
							timeline.push(`${name} stopped fetching`);
						}
					};
					Object.defineProperty(client, "offWork", { configurable: true, value: observed });
					return client;
				},
				connectionString,
				schedule: false,
				schema,
				supervise: false,
			}),
		),
	);
	const context = yield* Layer.buildWithScope(layer, scope);
	yield* testing.fetchesPass(queue, 1);
	timeline.push(`${name} started fetching`);
	return {
		holdJob: Jobs.pipe(
			Effect.flatMap((jobs) => jobs.enqueue(queue, { hold: true })),
			Effect.provideContext(context),
			Effect.andThen(Deferred.await(started)),
		),
		workingQueues: () => [...new Set((client?.getWipData?.() ?? []).map((worker) => worker.name))],
	};
});
