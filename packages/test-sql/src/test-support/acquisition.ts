import { Cause, Clock, Effect, Exit, Fiber, Option, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makePostgresTestLayer } from "#postgres.ts";
import { raceWithLock } from "#raceWithLock.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { outcomeOf } from "./outcome.ts";
import { configured, setup } from "./postgres.ts";

const create = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reservation = yield* Scope.make();
	const connection = yield* Scope.provide(sql.reserve, reservation);
	yield* connection.executeRaw("select 1", []);
	let caller: Fiber.Fiber<unknown, unknown> | undefined;
	let started = 0;
	const start = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
		started = yield* Clock.currentTimeMillis;
		caller = yield* Effect.forkScoped(effect, { startImmediately: true });
		yield* Effect.addFinalizer(() => Scope.close(reservation, Exit.void));
	});
	return {
		interrupt: () =>
			Effect.suspend(() => {
				if (caller === undefined) {
					return Effect.die(new Error("Start a caller first"));
				}
				return Fiber.interrupt(caller).pipe(
					Effect.andThen(Fiber.await(caller)),
					Effect.timeoutOption("500 millis"),
					Effect.map(Option.match({ onNone: () => "still waiting", onSome: outcomeOf })),
				);
			}),
		pending: () => Effect.sync(() => caller !== undefined && caller.pollUnsafe() === undefined),
		startRace: (release: "commit" | "rollback") =>
			start(raceWithLock({ effects: [sql`select 1`], lock: sql`select pg_advisory_xact_lock(42)`, release, timeout: "100 millis" })),
		startTransaction: () => start(withTestTransaction(sql`select 1`)),
		wait: () =>
			Effect.gen(function* () {
				if (caller === undefined) {
					return yield* Effect.die(new Error("Start a caller first"));
				}
				const exit = yield* Fiber.await(caller).pipe(Effect.timeoutOption("750 millis"));
				const outcome = Option.match(exit, {
					onNone: () => "still waiting",
					onSome: (ended) =>
						Exit.isFailure(ended) && Option.exists(Cause.findErrorOption(ended.cause), Cause.isTimeoutError) ? "timed out" : outcomeOf(ended),
				});
				return { elapsed: (yield* Clock.currentTimeMillis) - started, outcome };
			}),
	};
});

export const acquisition = storyKit({
	clock: "live",
	create: () => create,
	layer: makePostgresTestLayer({ ...setup().options, maxConnections: 1 }),
	name: "occupied PostgreSQL test pool",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => ({
		callerIsWaiting: () => {
			story.tell("the story checks whether the caller is still waiting");
			return engine.pending();
		},
		interruptCaller: () => {
			story.tell("the caller is interrupted while the only PostgreSQL connection stays reserved");
			return engine.interrupt();
		},
		startRace: (release: "commit" | "rollback") => {
			story.tell(`a race with ${release} release and a 100 millisecond deadline asks the occupied pool for its holder's connection`);
			return engine.startRace(release);
		},
		startTransaction: () => {
			story.tell("a rollback test asks the occupied PostgreSQL pool for a connection");
			return engine.startTransaction();
		},
		waitForCaller: () => {
			story.tell("the caller is given up to 750 milliseconds to finish while the connection stays reserved");
			return engine.wait();
		},
	}),
});
