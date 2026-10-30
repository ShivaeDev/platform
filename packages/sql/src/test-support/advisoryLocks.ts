import { Deferred, Effect, Exit, Fiber, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { advisoryXactLock } from "#advisoryXactLock.ts";
import { transact } from "#transact.ts";
import { onPostgres } from "./engines.ts";
import { outcomeOf } from "./outcome.ts";
import { Rejected } from "./transactionEngine.ts";

export type HolderEnding = "commits" | "is interrupted" | "rolls back";

interface Holder {
	readonly decide: Deferred.Deferred<"commit" | "roll back">;
	readonly fiber: Fiber.Fiber<void, unknown>;
	readonly key: bigint | string;
}

interface LockEngine {
	contender: Fiber.Fiber<void, unknown> | undefined;
	contenderOnArrival: string | undefined;
	holder: Holder | undefined;
	readonly sql: SqlClient.SqlClient;
}

function keyWords(key: bigint | string) {
	return typeof key === "string" ? `"${key}"` : `${key}n`;
}

function ending(exit: Exit.Exit<unknown, unknown>) {
	return Exit.isSuccess(exit) ? "committed" : outcomeOf(exit);
}

function inTransaction<E, R>(effect: Effect.Effect<void, E, R>) {
	return transact(effect, { onSqlError: (error) => error });
}

function backendPid(sql: SqlClient.SqlClient) {
	return Effect.map(sql<{ readonly pid: number }>`select pg_backend_pid() as pid`, ([row]) => row?.pid ?? -1);
}

function contenderTransaction(sql: SqlClient.SqlClient, key: bigint | string, started: Deferred.Deferred<number>) {
	return inTransaction(
		Effect.andThen(
			Effect.flatMap(backendPid(sql), (pid) => Deferred.succeed(started, pid)),
			advisoryXactLock(key),
		),
	);
}

function blockedSession(sql: SqlClient.SqlClient, pid: number) {
	const blocked = sql<{ readonly blocked: boolean }>`select cardinality(pg_blocking_pids(${pid})) > 0 as blocked`;
	// PostgreSQL signals nothing when a session starts waiting on a lock, so the kit polls the contender's blockers.
	return blocked.pipe(Effect.repeat({ schedule: Schedule.spaced("5 millis"), while: ([row]) => row?.blocked !== true }), Effect.orDie);
}

function holderOf(engine: LockEngine) {
	const holder = engine.holder;
	return holder === undefined ? Effect.die(new Error("Give the story a holder first")) : Effect.succeed(holder);
}

const lockEngine = Effect.fnUntraced(function* () {
	const engine: LockEngine = { contender: undefined, contenderOnArrival: undefined, holder: undefined, sql: yield* SqlClient.SqlClient };
	return engine;
});

export const advisoryLocks = storyKit({
	...onPostgres,
	create: lockEngine,
	name: "PostgreSQL advisory locks",
	stages: ["holder"],
	verbs: (engine: LockEngine, story: { readonly tell: (line: string) => void }) => {
		const { sql } = engine;
		return {
			contenderEnding: () =>
				Effect.gen(function* () {
					const contender = engine.contender;
					if (contender === undefined) {
						return yield* Effect.die(new Error("Start a contender first"));
					}
					const exit = yield* Fiber.await(contender);
					return Exit.isSuccess(exit) ? "acquired" : outcomeOf(exit);
				}),
			contenderOnArrival: () => Effect.sync(() => engine.contenderOnArrival ?? "no contender arrived"),
			contenderTakes: (key: bigint | string) =>
				Effect.gen(function* () {
					story.tell(`a contender's transaction takes the advisory lock on ${keyWords(key)}`);
					const started = yield* Deferred.make<number>();
					const fiber = yield* Effect.forkScoped(contenderTransaction(sql, key, started));
					engine.contender = fiber;
					const waiting = Effect.as(blockedSession(sql, yield* Deferred.await(started)), "waiting");
					engine.contenderOnArrival = yield* Effect.raceFirst(waiting, Effect.as(Fiber.await(fiber), "acquired"));
					return engine.contenderOnArrival;
				}),
			holderEnding: () => Effect.flatMap(holderOf(engine), (holder) => Effect.map(Fiber.await(holder.fiber), ending)),
			holderEnds: (how: HolderEnding) =>
				Effect.gen(function* () {
					const holder = yield* holderOf(engine);
					story.tell(`the holder's transaction ${how}`);
					if (how === "is interrupted") {
						yield* Fiber.interrupt(holder.fiber);
					} else {
						yield* Deferred.succeed(holder.decide, how === "commits" ? "commit" : "roll back");
					}
				}),
			holderState: () => Effect.map(holderOf(engine), (holder) => (holder.fiber.pollUnsafe() === undefined ? "still holding" : "ended")),
			lockOutsideTransaction: (key: bigint | string) =>
				Effect.suspend(() => {
					story.tell(`a caller takes the advisory lock on ${keyWords(key)} outside any transaction`);
					return Effect.map(Effect.exit(advisoryXactLock(key)), outcomeOf);
				}),
			rawSqlCallerTries: (expression: "bigint" | "hashtextextended") =>
				Effect.gen(function* () {
					const holder = yield* holderOf(engine);
					const key = String(holder.key);
					story.tell(
						expression === "bigint"
							? `a raw SQL caller tries pg_try_advisory_xact_lock('${key}'::bigint)`
							: `a raw SQL caller tries pg_try_advisory_xact_lock(hashtextextended('${key}', 0))`,
					);
					const tried =
						expression === "bigint"
							? sql<{ readonly acquired: boolean }>`select pg_try_advisory_xact_lock(${key}::bigint) as acquired`
							: sql<{ readonly acquired: boolean }>`select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as acquired`;
					const [row] = yield* sql.withTransaction(tried).pipe(Effect.orDie);
					return row?.acquired === true ? "acquired" : "already held";
				}),
		};
	},
});

export function holderHolds(key: bigint | string) {
	return advisoryLocks.trait("holder", `a holder's transaction takes the advisory lock on ${keyWords(key)} and stays open`, (engine) =>
		Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			const decide = yield* Deferred.make<"commit" | "roll back">();
			const fiber = yield* Effect.forkScoped(
				inTransaction(
					Effect.gen(function* () {
						yield* advisoryXactLock(key);
						yield* Deferred.succeed(entered, undefined);
						if ((yield* Deferred.await(decide)) === "roll back") {
							return yield* new Rejected({ message: "rolled back" });
						}
					}),
				),
			);
			yield* Effect.raceFirst(
				Deferred.await(entered),
				Effect.andThen(Fiber.await(fiber), Effect.die(new Error("The holder ended before it took the lock"))),
			);
			engine.holder = { decide, fiber, key };
		}),
	);
}
