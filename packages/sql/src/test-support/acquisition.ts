import { Effect, Exit, Fiber, Layer, Option, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgresLayer } from "#postgresLayer.ts";
import { transact } from "#transact.ts";
import { outcomeOf } from "./outcome.ts";
import { configured, postgresOptions } from "./postgres.ts";
import { onSqlError } from "./transactionEngine.ts";

const create = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reservation = yield* Scope.make();
	const connection = yield* Scope.provide(sql.reserve, reservation);
	yield* connection.executeRaw("select 1", []);
	let caller: Fiber.Fiber<unknown, unknown> | undefined;
	return {
		interrupt: () =>
			Effect.suspend(() => {
				if (caller === undefined) {
					return Effect.die(new Error("Start a transaction first"));
				}
				return Fiber.interrupt(caller).pipe(
					Effect.andThen(Fiber.await(caller)),
					Effect.timeoutOption("500 millis"),
					Effect.map(Option.match({ onNone: () => "still waiting", onSome: outcomeOf })),
				);
			}),
		pending: () => Effect.sync(() => caller !== undefined && caller.pollUnsafe() === undefined),
		start: Effect.gen(function* () {
			caller = yield* transact(sql`select 1`, { onSqlError }).pipe(Effect.forkScoped({ startImmediately: true }));
			yield* Effect.addFinalizer(() => Scope.close(reservation, Exit.void));
		}),
	};
});

export const acquisition = storyKit({
	clock: "live",
	create: () => create,
	layer: postgresLayer(postgresOptions.url, { maxConnections: 1 }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "PostgreSQL transaction acquisition",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => ({
		interruptTransaction: () => {
			story.tell("the caller interrupts the transaction while the only PostgreSQL connection stays reserved");
			return engine.interrupt();
		},
		startTransaction: () => {
			story.tell("transact asks the occupied PostgreSQL pool for a connection");
			return engine.start;
		},
		transactionIsWaiting: engine.pending,
	}),
});
