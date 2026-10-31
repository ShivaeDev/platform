import { Effect, Layer, ManagedRuntime, Redacted } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { appDatabase } from "@shivaedev/server/appHost.ts";
import { Order } from "./contract.ts";
import { OrderService } from "./OrderService.ts";
import { orderMigrations, repositoryLayer } from "./repository.ts";

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
		Layer.provideMerge(
			appDatabase({
				config: { changes: { channel: options.channel }, databaseUrl: Redacted.make(options.databaseUrl) },
				migrations: { loader: orderMigrations(options.table), table: options.ledger },
			}),
		),
	);
	const runtime = ManagedRuntime.make(
		Jobs.layer({
			jobs: [queue.handle((input) => OrderService.use((orders) => orders.save("alice", input)).pipe(Effect.tap(() => Effect.sync(handled))))],
		})
			.pipe(Layer.provide(pgBossLayer({ connectionString: Redacted.make(options.databaseUrl), schema: options.schema })))
			.pipe(Layer.provideMerge(service)),
	);
	return {
		close: () => runtime.dispose(),
		enqueue: (input: Order) => runtime.runPromise(Jobs.use((jobs) => jobs.enqueue(queue, input))),
		ready: () => runtime.runPromise(Jobs),
	};
}
