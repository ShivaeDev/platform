import { Deferred, Effect, Exit, Fiber, Queue, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { type InvalidationKeys, invalidateOnCommit, transact } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import { attempt, outcomeOf } from "./outcome.ts";
import { onSqlError, Rejected, type TransactionEngine } from "./transactionEngine.ts";

function isList(keys: InvalidationKeys): keys is readonly unknown[] {
	return Array.isArray(keys);
}

function described(keys: InvalidationKeys) {
	if (isList(keys)) {
		return keys.join(", ");
	}
	return Object.entries(keys)
		.map(([name, ids]) => `${name} ${ids.map(String).join(", ")}`)
		.join("; ");
}

function idsOf(rows: ReadonlyArray<{ readonly id: string }>) {
	return rows.map(({ id }) => {
		const value = BigInt(id);
		return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
	});
}

function onClient(client: SqlClient.SqlClient) {
	return Effect.provideService(SqlClient.SqlClient, client);
}

export function transactionVerbs(engine: TransactionEngine, tell: (line: string) => void) {
	const { main, other, tables } = engine;
	function transactOn<A, E, R>(client: SqlClient.SqlClient, effect: Effect.Effect<A, E, R>) {
		return transact(effect, { onSqlError }).pipe(onClient(client));
	}
	function ordersOn(client: SqlClient.SqlClient, table: string) {
		return Effect.map(client<{ readonly id: string }>`select cast(id as text) as id from ${client(table)} order by id`, idsOf).pipe(Effect.orDie);
	}
	function ended(exit: Exit.Exit<unknown, unknown>) {
		const ending = Exit.isSuccess(exit) ? "committed" : outcomeOf(exit);
		engine.endings.push(ending);
		return ending;
	}
	function postgresOnly() {
		return engine.database === "PostgreSQL" ? Effect.void : Effect.die(new Error("This verb needs the PostgreSQL transaction kit"));
	}
	return {
		announce: (keys: InvalidationKeys) =>
			Effect.suspend(() => {
				tell(`the body announces ${described(keys)}`);
				return invalidateOnCommit(keys);
			}),
		announced: () => Effect.sync(() => [...engine.announced]),
		announceForOther: (keys: InvalidationKeys) =>
			Effect.suspend(() => {
				tell(`the body announces ${described(keys)} for the other client`);
				return invalidateOnCommit(keys).pipe(onClient(other));
			}),
		endings: () => Effect.sync(() => [...engine.endings]),
		inNativeTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("the main client begins a native sql.withTransaction that transact does not own");
				return attempt(main.withTransaction(Effect.gen(body)));
			}),
		inOtherTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("the other client begins a transaction");
				return Effect.map(Effect.exit(transactOn(other, Effect.gen(body))), ended);
			}),
		inTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("the main client begins a transaction");
				return Effect.map(Effect.exit(transactOn(main, Effect.gen(body))), ended);
			}),
		interruptCommit: () =>
			Effect.gen(function* () {
				const committing = engine.committing;
				if (committing === undefined) {
					return yield* Effect.die(new Error("Start a slow commit before interrupting it"));
				}
				tell("the caller interrupts the transaction while its COMMIT is in flight");
				yield* Fiber.interrupt(committing.fiber);
				return ended(yield* Fiber.await(committing.fiber));
			}),
		interruptTransactionAfter: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.gen(function* () {
				tell("the main client begins a transaction, and the caller interrupts it once its body has run");
				const ran = yield* Deferred.make<void>();
				const fiber = yield* Effect.forkChild(
					transactOn(main, Effect.andThen(Effect.gen(body), Effect.andThen(Deferred.succeed(ran, undefined), Effect.never))),
				);
				yield* Effect.raceFirst(Deferred.await(ran), Effect.asVoid(Fiber.await(fiber)));
				yield* Fiber.interrupt(fiber);
				return ended(yield* Fiber.await(fiber));
			}),
		loggedErrors: () =>
			Effect.sync(() =>
				engine.logs
					.filter(({ level }) => level === "Error")
					.map(({ annotations, cause, message }) => {
						const reason = cause.split("\n")[0]?.replace(/^Error: /u, "");
						return `${String(message)}: ${reason} (${String(annotations.changes)} changes on ${String(annotations.channel)})`;
					}),
			),
		nextQueryResult: () =>
			Effect.suspend(() => {
				const results = engine.liveOrders;
				return results === undefined ? Effect.die(new Error("Query the orders from the other pool first")) : Queue.take(results);
			}).pipe(Effect.orDie),
		orders: () => ordersOn(main, tables.orders),
		otherOrders: () => ordersOn(other, tables.others),
		queryOrdersFromOtherPool: () =>
			Effect.gen(function* () {
				yield* postgresOnly();
				tell("the other client runs a live query of the orders, refreshed by the orders key");
				engine.liveOrders = yield* engine.reactivity.query(["orders"], ordersOn(other, tables.orders));
			}),
		rejects: () =>
			Effect.suspend(() => {
				tell("the body rejects its work");
				return Effect.fail(new Rejected({ message: "rejected" }));
			}),
		saveOrder: (id: number | bigint) =>
			Effect.suspend(() => {
				tell(`order ${id} is saved to the main client`);
				return main`insert into ${main(tables.orders)} (id, name) values (${String(id)}, ${`order ${id}`})`;
			}),
		saveOrderLeavingStraggler: (id: number, keys: InvalidationKeys) =>
			Effect.gen(function* () {
				tell(`order ${id} is saved in a transaction, and a fiber it forked waits to announce ${described(keys)}`);
				const release = yield* Deferred.make<void>();
				const fiber = yield* transactOn(
					main,
					Effect.andThen(
						main`insert into ${main(tables.orders)} (id, name) values (${id}, ${`order ${id}`})`,
						Effect.forkChild(Effect.andThen(Deferred.await(release), invalidateOnCommit(keys))),
					),
				);
				engine.straggler = { fiber, release: Deferred.succeed(release, undefined) };
			}),
		saveOtherOrder: (id: number) =>
			Effect.suspend(() => {
				tell(`order ${id} is saved to the other client`);
				return other`insert into ${other(tables.others)} (id) values (${id})`;
			}),
		startSlowCommit: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.gen(function* () {
				yield* postgresOnly();
				tell("the main client begins a transaction whose COMMIT takes a second");
				const backend = yield* Deferred.make<number>();
				const pid = Effect.flatMap(main<{ readonly pid: number }>`select pg_backend_pid() as pid`, ([row]) =>
					Deferred.succeed(backend, row?.pid ?? -1),
				);
				const fiber = yield* Effect.forkChild(transactOn(main, Effect.andThen(Effect.gen(body), pid)));
				const committing = other<{ readonly committing: boolean }>`select exists (
					select 1 from pg_stat_activity where pid = ${yield* Deferred.await(backend)} and state = 'active' and query = 'COMMIT'
				) as committing`;
				// PostgreSQL signals nothing when a session starts its COMMIT, so the kit polls the other pool's activity view.
				yield* committing.pipe(Effect.repeat({ schedule: Schedule.spaced("5 millis"), while: ([row]) => row?.committing !== true }), Effect.orDie);
				engine.committing = { fiber };
			}),
		stragglerAnnounces: () =>
			Effect.gen(function* () {
				const straggler = engine.straggler;
				if (straggler === undefined) {
					return yield* Effect.die(new Error("Save an order leaving a straggler before resuming it"));
				}
				tell("the forked fiber announces its keys after the transaction committed");
				yield* straggler.release;
				return outcomeOf(yield* Fiber.await(straggler.fiber));
			}),
		visibleOrders: () => Effect.andThen(postgresOnly(), ordersOn(other, tables.orders)),
		writeNoteForMissingOrder: () =>
			Effect.suspend(() => {
				tell("the body writes a note for order 99, which does not exist, under a foreign key checked at COMMIT");
				return main`insert into ${main(tables.notes)} (id, order_id) values (1, 99)`;
			}),
	};
}
