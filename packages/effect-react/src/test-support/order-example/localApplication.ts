import { Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { isolate, rollback } from "./isolation.ts";
import { hasPostgres, kitDatabases, StoryDatabase, workerDatabase } from "./postgres.ts";
import { seedOrder } from "./seed.ts";
import { makeOrdersRepository, OrderService, OrdersRepository } from "./service.ts";

export const localApplication = storyKit({
	around: isolate,
	*create() {
		const database = yield* StoryDatabase;
		const supplied = yield* Effect.serviceOption(Reactivity.Reactivity);
		const reactivity = supplied._tag === "Some" ? supplied.value : Context.get(yield* Layer.build(Reactivity.layer), Reactivity.Reactivity);
		const changes: unknown[] = [];
		const unregister = reactivity.registerUnsafe(["orders"], () => changes.push("orders"));
		yield* Effect.addFinalizer(() => Effect.sync(unregister));
		const service = Context.get(
			yield* Layer.build(
				OrderService.layer.pipe(
					Layer.provide(Layer.effect(OrdersRepository, makeOrdersRepository)),
					Layer.provide(Layer.succeed(SqlClient.SqlClient, database.sql)),
					Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity)),
				),
			),
			OrderService,
		);
		return { changes, database, id: 0, service };
	},
	layer: workerDatabase,
	name: "local orders",
	runIf: hasPostgres,
	stages: ["orders"],
	verbs: (engine, story) => ({
		changes: () => [...engine.changes],
		inRollback: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			rollback(effect).pipe(Effect.provideService(SqlClient.SqlClient, engine.database.sql), Effect.provide(Reactivity.layer)),
		observerOrders: () => engine.database.observer`select id from orders`,
		rejectLocally: () => {
			story.tell("Alice tries an invalid nested save");
			return engine.service.save("alice", { id: engine.id, name: "Rejected", quantity: -1 }).pipe(Effect.result);
		},
		saveLocally: () => {
			story.tell("Alice saves the order inside the story transaction");
			return engine.service.save("alice", { id: engine.id, name: "Local save", quantity: 12 });
		},
		seedLocalOrder: () =>
			Effect.gen(function* () {
				story.tell("Alice seeds an order inside the story transaction");
				engine.id = (yield* seedOrder().pipe(Effect.provideService(SqlClient.SqlClient, engine.database.sql))).id;
			}),
		sharesWorkerDatabase: () => kitDatabases.has(engine.database.name),
	}),
});
