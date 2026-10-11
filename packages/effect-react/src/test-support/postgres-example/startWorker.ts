import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, ManagedRuntime, Redacted } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { defineQueue } from "@shivaedev/effect-pg-boss/definition.ts";
import { makePgBoss } from "@shivaedev/effect-pg-boss/service.ts";
import { postgresChanges } from "@shivaedev/effect-sql/postgresChanges.ts";
import { Order } from "./contract.ts";
import { OrderService } from "./OrderService.ts";
import { repositoryLayer } from "./repository.ts";

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
	const base = Layer.merge(PgClient.layer({ url: Redacted.make(options.databaseUrl) }), Reactivity.layer);
	const delivery = Layer.unwrap(
		Effect.gen(function* () {
			const client = yield* PgClient.PgClient;
			return postgresChanges({ channel: options.channel, client, resync: Effect.void });
		}),
	);
	const service = OrderService.layer.pipe(
		Layer.provide(repositoryLayer(options.table, options.ledger)),
		Layer.provideMerge(delivery.pipe(Layer.provideMerge(base))),
	);
	const runtime = ManagedRuntime.make(
		Jobs.layer({
			connectionString: options.databaseUrl,
			jobs: [queue.handle((input) => OrderService.use((orders) => orders.save("alice", input)).pipe(Effect.tap(() => Effect.sync(handled))))],
			schema: options.schema,
		}).pipe(Layer.provideMerge(service)),
	);
	return {
		close: () => runtime.dispose(),
		enqueue: (input: Order) => runtime.runPromise(Jobs.use((jobs) => jobs.enqueue(queue, input))),
		ready: () => runtime.runPromise(Jobs),
	};
}
