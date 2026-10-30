import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Migrator, SqlClient } from "effect/sql";
import { invalidateOnCommit } from "@shivaedev/sql/transact.ts";
import { database } from "./database.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { inPlace, writeItem } from "./databaseVerbs.ts";
import { limitedRole } from "./limitedRole.ts";

export function poolLimit(maxConnections: number) {
	return database.trait("configuration", `pools allow ${maxConnections} connections`, (engine) => {
		engine.options = { ...engine.options, maxConnections };
	});
}

export function roleLimit(limit = 1) {
	return database.trait("configuration", `the role allows ${limit} connections`, function* (engine) {
		engine.options = { ...engine.options, url: yield* limitedRole(limit).pipe(Effect.provideService(Scope.Scope, engine.scope)) };
	});
}

export const exhaustedRole = database.trait("configuration", "another client holds the role's only connection", function* (engine) {
	yield* PgClient.makeClient({ url: engine.options.url }).pipe(Effect.provideService(Scope.Scope, engine.scope));
});

export const markedSessions = database.trait("configuration", "the worker's sessions carry a unique application name", (engine) => {
	const url = new URL(Redacted.value(engine.options.url));
	url.searchParams.set("application_name", engine.marker);
	engine.options = { ...engine.options, url: Redacted.make(url.toString()) };
});

export const withoutFixtures = database.trait("configuration", "only migrations prepare the template", (engine) => {
	engine.options = { migrations: engine.fixture.options.migrations, url: engine.options.url };
});

export const sequence = database.trait("configuration", "the template's only migration creates a fresh sequence", (engine) => {
	engine.options = {
		migrations: {
			loader: Migrator.fromRecord({
				"1_create_sequence": Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					yield* sql`create sequence test_ids`;
				}),
			}),
			lockTimeout: "5 seconds",
		},
		url: engine.options.url,
	};
});

export type Preparation = "the initializer" | "the fixtures";

export function failingPreparation(step: Preparation) {
	return database.trait("configuration", `${step} fail with "${step} failed" in the migrated template`, (engine) => {
		const fails = Effect.andThen(Effect.andThen(engine.recordTemplate(), engine.recordOwnDatabases()), Effect.fail(`${step} failed`));
		engine.options =
			step === "the initializer"
				? { fixtures: Effect.die("the fixtures must not run after the initializer fails"), initialize: fails, url: engine.options.url }
				: { ...engine.options, fixtures: fails };
	});
}

export type Strategy = "an initializer" | "migrations";

export function preparationDisabled(strategy: Strategy) {
	return database.trait("configuration", `preparation is disabled for ${strategy} and fixtures that would die if they ran`, (engine) => {
		const fixtures = Effect.die("the fixtures must not run when preparation is disabled");
		engine.options =
			strategy === "an initializer"
				? { fixtures, initialize: Effect.die("the initializer must not run when preparation is disabled"), prepare: false, url: engine.options.url }
				: {
						fixtures,
						migrations: { ...engine.fixture.options.migrations, loader: Effect.die("the migrations must not load when preparation is disabled") },
						prepare: false,
						url: engine.options.url,
					};
	});
}

export function rollbackTestOpen(name = "the rollback test") {
	return database.trait("activity", `${name} has begun on the shared database`, (engine) => engine.open(name, "rollback test"));
}

export function isolatedBlockOpen(name = "the isolated block") {
	return database.trait("activity", `${name} has opened its clone`, (engine) => engine.open(name, "isolated block"));
}

export function itemWritten(value: string, place: string) {
	return database.trait("activity", `${place} wrote the item "${value}"`, (engine) => inPlace(engine, place, writeItem(value)));
}

export const sharedConnectionIdle = database.trait("activity", "a query left one connection idle in the shared pool", (engine) =>
	engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select 1`)),
);

export const sharedDrewId = database.trait("activity", "the shared database already drew id 1 from the sequence", (engine) =>
	engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select nextval('test_ids')`)),
);

export const watchingInvalidations = database.trait("activity", "the shared database's Reactivity records every published key", (engine) =>
	engine.run(
		Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			const unregister = reactivity.registerUnsafe(["items"], () => engine.published.push("items"));
			yield* Effect.addFinalizer(() => Effect.sync(unregister));
		}),
	),
);

export function itemsInvalidated(block: string) {
	return database.trait("activity", `${block} invalidates the items key on commit`, (engine) => engine.inBlock(block, invalidateOnCommit(["items"])));
}

function queryClone(sql: SqlClient.SqlClient, engine: DatabaseEngine) {
	return sql<{ answer: number }>`select 1 as answer`.pipe(
		Effect.map(([row]) => `answered ${row?.answer}`),
		Effect.catch((error) => Effect.succeed(`failed: ${String(error)}`)),
		Effect.flatMap((answer) =>
			Effect.sync(() => {
				engine.finalizerQuery = answer;
			}),
		),
	);
}

export function finalizerQueriesClone(block: string) {
	return database.trait("activity", `${block} registers a finalizer that queries its clone`, (engine) =>
		engine.inBlock(
			block,
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				engine.finalizerQuery = "not run";
				yield* Effect.addFinalizer(() => queryClone(sql, engine));
			}),
		),
	);
}
