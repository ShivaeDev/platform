import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Context, Effect, Layer, Redacted, Semaphore } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { assertLocalDatabase } from "@shivaedev/local-postgres/server/localPostgres.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";

export const databaseUrl = Effect.runSync(Config.String("PLATFORM_SQL_TEST_DATABASE_URL").pipe(Config.option));
const destination = databaseUrl._tag === "Some" ? databaseUrl.value : undefined;
export const hasPostgres = destination !== undefined;
export const kitDatabases = new Set<string>();
const name = `platform_story_${crypto.randomUUID().replaceAll("-", "")}`;
const leases = Semaphore.makeUnsafe(1);
let references = 0;

export function disposableDestination(value: string) {
	const url = assertLocalDatabase(value, ["platform_test_sql"]);
	if (!/^platform_story_[a-f0-9]{32}$/u.test(name)) {
		throw new Error("Invalid disposable database name");
	}
	return url;
}

function pool(url: URL) {
	return PgClient.layer({ maxConnections: 4, url: Redacted.make(url.toString()) });
}

export const migrations = migratePostgres({
	loader: Migrator.fromRecord({
		"1_orders": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table orders (id integer generated always as identity primary key, "ownerId" text not null, name text not null, quantity integer not null)`;
		}),
	}),
	lockTimeout: "5 seconds",
});

export class StoryDatabase extends Context.Service<
	StoryDatabase,
	{
		readonly name: string;
		readonly sql: SqlClient.SqlClient;
		readonly observer: SqlClient.SqlClient;
	}
>()("order/StoryDatabase") {}

function lease(admin: SqlClient.SqlClient) {
	const acquire = Effect.gen(function* () {
		if (references === 0) {
			yield* admin`create database ${admin(name)}`;
		}
		references += 1;
		return name;
	});
	const release = Effect.gen(function* () {
		references -= 1;
		if (references === 0) {
			yield* admin`drop database ${admin(name)}`;
		}
	});
	return Effect.acquireRelease(leases.withPermits(1)(acquire), () => leases.withPermits(1)(release).pipe(Effect.orDie));
}

export const acquireDatabaseWith = Effect.fn("StoryDatabase.acquireDatabaseWith")(function* (
	prepare: Effect.Effect<unknown, unknown, SqlClient.SqlClient>,
) {
	if (destination === undefined) {
		return yield* Effect.die(new Error("Set PLATFORM_SQL_TEST_DATABASE_URL to run database stories"));
	}
	const url = disposableDestination(destination);
	const adminUrl = new URL(url);
	adminUrl.pathname = "/postgres";
	const admin = Context.get(yield* Layer.build(pool(adminUrl)), SqlClient.SqlClient);
	yield* lease(admin);
	url.pathname = `/${name}`;
	const sql = Context.get(yield* Layer.build(pool(url)), SqlClient.SqlClient);
	const observer = Context.get(yield* Layer.build(pool(url)), SqlClient.SqlClient);
	yield* prepare.pipe(Effect.provideService(SqlClient.SqlClient, sql));
	return { name, observer, sql };
});

export const acquireDatabase = acquireDatabaseWith(migrations);

export const workerDatabase = Layer.effect(StoryDatabase, acquireDatabase);

export function reset(database: Context.Service.Shape<typeof StoryDatabase>) {
	return database.sql`truncate table orders restart identity`.pipe(Effect.asVoid);
}
