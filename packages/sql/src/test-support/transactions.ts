import { Effect, Exit, Scope } from "effect";
import { type StoryKit, storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type EngineServices, onPostgresClients, onSqlite } from "./engines.ts";
import { type Database, type TransactionEngine, transactionEngine } from "./transactionEngine.ts";
import { transactionVerbs } from "./transactionVerbs.ts";

function inspect(engine: TransactionEngine) {
	return { announced: engine.announced, logs: engine.logs };
}

function definition(database: Database) {
	return {
		create: transactionEngine(database),
		inspect,
		name: `${database} transactions`,
		stages: ["schema", "subscribers"],
		verbs: (engine: TransactionEngine, story: { readonly tell: (line: string) => void }) => transactionVerbs(engine, story.tell),
	} as const;
}

export const postgresTransactions = storyKit({ ...onPostgresClients, ...definition("PostgreSQL") });
export const sqliteTransactions = storyKit({ ...onSqlite, ...definition("SQLite") });

type Kit = StoryKit<TransactionEngine, "schema" | "subscribers", ReturnType<typeof transactionVerbs>, never, EngineServices>;

export const transactionKits: readonly Kit[] = [postgresTransactions, sqliteTransactions];

export function subscribers(kit: Kit, keys: Readonly<Record<string, readonly unknown[]>>) {
	return kit.trait("subscribers", `subscribers watch ${Object.keys(keys).join(", ")}`, function* (engine) {
		for (const [name, watched] of Object.entries(keys)) {
			const stop = engine.reactivity.registerUnsafe(watched, () => engine.announced.push(name));
			yield* Effect.addFinalizer(() => Effect.sync(stop));
		}
	});
}

export function watching(kit: Kit, ...keys: readonly string[]) {
	return kit.trait("subscribers", `a subscriber watches ${keys.join(", ")}`, function* (engine) {
		for (const key of keys) {
			const stop = engine.reactivity.registerUnsafe([key], () => engine.announced.push(key));
			yield* Effect.addFinalizer(() => Effect.sync(stop));
		}
	});
}

export function subscriberThrows(kit: Kit, key: string) {
	return kit.trait("subscribers", `the subscriber to ${key} throws`, function* (engine) {
		const stop = engine.reactivity.registerUnsafe([key], () => {
			throw new Error("subscriber threw");
		});
		yield* Effect.addFinalizer(() => Effect.sync(stop));
	});
}

export function commitsWhenReleased() {
	return postgresTransactions.trait("schema", "a deferred trigger holds COMMIT on an advisory lock until the kit releases it", function* (engine) {
		const { main, other, tables } = engine;
		const name = tables.orders.replace("transact_orders_", "transact_slow_");
		const scope = yield* Scope.fork(yield* Effect.scope);
		const connection = yield* Scope.provide(other.reserve, scope);
		yield* Effect.acquireRelease(connection.executeRaw("select pg_advisory_lock(hashtextextended($1, 0))", [name]), () =>
			connection.executeRaw("select pg_advisory_unlock(hashtextextended($1, 0))", [name]).pipe(Effect.orDie),
		).pipe(Scope.provide(scope));
		engine.commitGate = { release: Scope.close(scope, Exit.void) };
		yield* Effect.acquireRelease(
			Effect.andThen(
				main.unsafe(
					`create function "${name}"() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(hashtextextended('${name}', 0)); return null; end $$`,
				),
				main.unsafe(
					`create constraint trigger "${name}" after insert on "${tables.orders}" deferrable initially deferred for each row execute function "${name}"()`,
				),
			),
			() => Effect.orDie(main.unsafe(`drop function "${name}"() cascade`)),
		);
	});
}

export function ordersHaveBigintIds() {
	return postgresTransactions.trait("schema", "order ids are bigint", ({ main, tables }) =>
		main`alter table ${main(tables.orders)} alter column id type bigint`.pipe(Effect.asVoid),
	);
}
