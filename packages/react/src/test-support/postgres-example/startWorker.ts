import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Effect, Layer, ManagedRuntime, Redacted } from "effect";
import { Identity } from "@shivaedev/identity/identity.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { BeforeOrderCommit } from "./BeforeOrderCommit.ts";
import { Order } from "./contract.ts";
import { orderMigrations, repositoryLayer } from "./repository.ts";
import { OrderService } from "./service.ts";

export function startWorker(
	options: {
		readonly databaseUrl: string;
		readonly table: string;
		readonly ledger: string;
		readonly channel: string;
		readonly queue: string;
		readonly schema: string;
	},
	handled: () => void,
) {
	const queue = defineQueue({ name: options.queue, schema: Order, worker: { pollingIntervalSeconds: 0.5 } });
	const Jobs = makePgBoss("order-example/Jobs");
	const service = OrderService.layer.pipe(
		Layer.provide(repositoryLayer(options.table)),
		Layer.provide(Layer.succeed(Identity, { id: "alice" })),
		Layer.provide(Layer.succeed(BeforeOrderCommit, Effect.void)),
		Layer.provideMerge(
			appDatabase({
				config: { changes: { channel: options.channel }, databaseUrl: Redacted.make(options.databaseUrl) },
				migrations: { loader: orderMigrations(options.table), table: options.ledger },
				postgresSettings: {},
			}),
		),
	);
	const runtime = ManagedRuntime.make(
		Jobs.layer({
			jobs: [queue.handle((input) => OrderService.use((orders) => orders.save(input)).pipe(Effect.tap(() => Effect.sync(handled))))],
		})
			.pipe(Layer.provide(pgBossLayer({ connectionString: Redacted.make(options.databaseUrl), schema: options.schema })))
			.pipe(Layer.provideMerge(service), Layer.provide(NodeCrypto.layer)),
	);
	return {
		close: () => runtime.dispose(),
		enqueue: (input: Order) => runtime.runPromise(Jobs.use((jobs) => jobs.enqueue(queue, input))),
		ready: () => runtime.runPromise(Jobs),
	};
}
