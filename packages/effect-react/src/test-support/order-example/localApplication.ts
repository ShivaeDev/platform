import { Context, Effect, Layer, Result } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { isolate, localRollback } from "./isolation.ts";
import { hasPostgres, kitDatabases, StoryDatabase, workerDatabase } from "./postgres.ts";
import { seedOrder } from "./seed.ts";
import { makeOrdersRepository, OrderService, OrdersRepository } from "./service.ts";

export const localApp = storyKit({
	around: isolate(localRollback),
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
		nothingWasPublished: () => Effect.sync(() => expect(engine.changes).toEqual([])),
		observerSeesNoOrders: () =>
			Effect.gen(function* () {
				expect(yield* engine.database.observer`select id from orders`).toEqual([]);
			}),
		rejectLocally: () =>
			Effect.gen(function* () {
				story.tell("Alice's invalid nested save is rejected");
				const result = yield* engine.service.save("alice", { id: engine.id, name: "Rejected", quantity: -1 }).pipe(Effect.result);
				expect(Result.isFailure(result) && result.failure).toMatchObject({ _tag: "OrderValidation" });
			}),
		saveLocally: () =>
			Effect.gen(function* () {
				story.tell("Alice saves the order inside the story transaction");
				const saved = yield* engine.service.save("alice", { id: engine.id, name: "Local save", quantity: 12 });
				expect(saved).toMatchObject({ name: "Local save", quantity: 12 });
			}),
		sharesWorkerDatabase: () => Effect.sync(() => expect(kitDatabases.has(engine.database.name)).toBe(true)),
	}),
});
export function localOrder() {
	return localApp.trait("orders", "Alice seeds an order inside the story transaction", function* (engine) {
		engine.id = (yield* seedOrder().pipe(Effect.provideService(SqlClient.SqlClient, engine.database.sql))).id;
	});
}
