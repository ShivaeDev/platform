import { Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { isolate, rollback } from "./isolation.ts";
import { hasPostgres, StoryDatabase, workerDatabase } from "./postgres.ts";
import { seedOrder } from "./seed.ts";
import { makeOrdersRepository, OrderService, OrdersRepository } from "./service.ts";
import { outcomeOf } from "./verbs.ts";

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
		const inside: unknown = undefined;
		return { changes, database, inside, service };
	},
	layer: workerDatabase,
	name: "local orders",
	runIf: hasPostgres,
	stages: ["orders"],
	verbs: (engine, story) => ({
		changes: () => Effect.sync(() => [...engine.changes]),
		insideRollback: () => Effect.sync(() => engine.inside),
		observerOrders: () => engine.database.observer`select id from orders`,
		rollbackStory: () =>
			Effect.gen(function* () {
				story.tell("Alice seeds an order, saves it and tries an invalid save inside a rolled-back story transaction");
				const inside = Effect.gen(function* () {
					const order = yield* seedOrder();
					const saved = yield* engine.service.save("alice", { id: order.id, name: "Local save", quantity: 12 });
					const rejected = yield* outcomeOf(engine.service.save("alice", { id: order.id, name: "Rejected", quantity: -1 }));
					return {
						changes: [...engine.changes],
						observerOrders: yield* engine.database.observer`select id from orders`,
						rejected,
						saved: `${saved.name} / ${saved.quantity}`,
					};
				});
				engine.inside = yield* rollback(inside).pipe(
					Effect.provideService(SqlClient.SqlClient, engine.database.sql),
					Effect.provide(Reactivity.layer),
				);
			}),
	}),
});
