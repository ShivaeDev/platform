import { Context, Effect, Exit, Layer, Queue, Schema, Scope } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { PgBossClient } from "#client.ts";
import { defineQueue } from "#definition.ts";
import { makePgBoss, pgBossLayer } from "#service.ts";
import { postgresConfigured, postgresLayer } from "#test/postgres/layer.ts";
import { makePgBossTesting } from "#testing.ts";

const Registration = makePgBoss("@test/SharedRegistration");
const Worker = makePgBoss("@test/SharedWorker");
const Producer = makePgBoss("@test/SharedProducer");
const Work = defineQueue({ name: "shared-client", schema: Schema.Struct({ message: Schema.String }) });

export const sharedClient = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const delivered = yield* Queue.unbounded<string>();
		const scope = yield* Scope.fork(yield* Scope.Scope);
		const testing = makePgBossTesting();
		const lifecycle = { created: 0, stopped: 0 };
		const app = pgBossLayer({
			clientFactory: (options) => {
				lifecycle.created += 1;
				const client = testing.clientFactory(options);
				const stop: PgBossClient["stop"] = async (settings) => {
					await client.stop(settings);
					lifecycle.stopped += 1;
				};
				return new Proxy(client, { get: (target, property) => (property === "stop" ? stop : Reflect.get(target, property)) });
			},
			connectionString: database.url,
			max: 2,
		});
		const services = Layer.mergeAll(
			Registration.layer({ jobs: [Work] }),
			Worker.layer({ jobs: [Work.handle(({ message }) => Queue.offer(delivered, message))] }),
			Producer.layer({ jobs: [Work] }),
		).pipe(Layer.provide(app));
		const context = yield* Layer.buildWithScope(services, scope);
		return { delivered, lifecycle, producer: Context.get(context, Producer), registration: Context.get(context, Registration), scope, testing };
	},
	inspect: ({ lifecycle }) => lifecycle,
	layer: postgresLayer,
	name: "one app pg-boss client",
	runIf: postgresConfigured,
	stages: [],
	verbs: (engine, story) => ({
		close: () => {
			story.tell("the application closes its jobs Layer");
			return engine.testing.waitForIdle.pipe(Effect.andThen(Scope.close(engine.scope, Exit.void)));
		},
		deliveredMessage: () => Queue.take(engine.delivered),
		lifecycle: () => Effect.sync(() => ({ ...engine.lifecycle })),
		publish: (message: string) => {
			story.tell(`the producer publishes ${message}`);
			return engine.producer.enqueue(Work, { message });
		},
		registeredQueues: () => Effect.map(engine.registration.health(), (health) => health.jobs.map(({ name }) => name)),
	}),
});
