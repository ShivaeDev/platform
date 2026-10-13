import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { expect, it } from "vitest";
import { isolate, wholeStack } from "#test/order-example/isolation.ts";
import {
	acquireDatabase,
	acquireDatabaseWith,
	databaseUrl,
	disposableDestination,
	hasPostgres,
	StoryDatabase,
} from "#test/order-example/postgres.ts";
import { seedOrder } from "#test/order-example/seed.ts";

const integration = it.runIf(hasPostgres);
function run<A, E>(effect: Effect.Effect<A, E, Scope.Scope>) {
	return Effect.runPromise(Effect.scoped(effect));
}
function admin() {
	const url = disposableDestination(databaseUrl._tag === "Some" ? databaseUrl.value : "");
	url.pathname = "/postgres";
	return Layer.build(PgClient.layer({ url: Redacted.make(url.toString()) })).pipe(Effect.map((context) => Context.get(context, SqlClient.SqlClient)));
}

integration("database leases share one disposable database, close pools before the last drop, and preserve the migration ledger", () =>
	run(
		Effect.gen(function* () {
			const observer = yield* admin();
			const firstScope = yield* Scope.make();
			const secondScope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Effect.all([Scope.close(firstScope, Exit.void), Scope.close(secondScope, Exit.void)]));
			const first = yield* acquireDatabase.pipe(Effect.provideService(Scope.Scope, firstScope));
			const second = yield* acquireDatabase.pipe(Effect.provideService(Scope.Scope, secondScope));
			expect(first.name).toBe(second.name);
			yield* first.sql`select 1`;
			yield* first.observer`select 1`;
			yield* second.sql`select 1`;
			yield* Scope.close(firstScope, Exit.void);
			expect(yield* second.observer`select migration_id from effect_sql_migrations`).toEqual([{ "migration_id": 1 }]);
			yield* Scope.close(secondScope, Exit.void);
			expect(yield* observer`select datname from pg_database where datname = ${first.name}`).toEqual([]);
		}),
	),
);

integration("a failed acquisition after pool setup releases the database, and impossible seeds insert nothing", () =>
	run(
		Effect.gen(function* () {
			const observer = yield* admin();
			let name = "";
			const exit = yield* Effect.scoped(
				Effect.gen(function* () {
					const database = yield* acquireDatabase;
					name = database.name;
					const result = yield* seedOrder({ quantity: -1 }).pipe(Effect.provideService(SqlClient.SqlClient, database.sql), Effect.result);
					expect(result._tag).toBe("Failure");
					expect(yield* database.observer`select id from orders`).toEqual([]);
					return yield* Effect.fail("application setup failed after database acquisition");
				}),
			).pipe(Effect.exit);
			expect(exit).toEqual(Exit.fail("application setup failed after database acquisition"));
			expect(yield* observer`select datname from pg_database where datname = ${name}`).toEqual([]);
		}),
	),
);

integration("migration failure during database acquisition closes pools and releases the lease", () =>
	run(
		Effect.gen(function* () {
			const observer = yield* admin();
			let name = "";
			const brokenMigration = Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const [row] = yield* sql<{ name: string }>`select current_database() as name`;
				name = row?.name ?? "";
				return yield* Effect.fail("migration setup failed");
			});
			const exit = yield* Effect.scoped(acquireDatabaseWith(brokenMigration)).pipe(Effect.exit);
			expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe("migration setup failed");
			expect(name).toMatch(/^platform_story_/u);
			expect(yield* observer`select datname from pg_database where datname = ${name}`).toEqual([]);
		}),
	),
);

integration("interruption closes the database pools and drops the worker database", () =>
	run(
		Effect.gen(function* () {
			const observer = yield* admin();
			const acquired = yield* Deferred.make<string>();
			const fiber = yield* Effect.scoped(
				Effect.gen(function* () {
					const database = yield* acquireDatabase;
					yield* Deferred.succeed(acquired, database.name);
					yield* database.sql`select pg_sleep(30)`;
				}),
			).pipe(Effect.forkScoped);
			const name = yield* Deferred.await(acquired).pipe(Effect.timeout("5 seconds"));
			yield* Fiber.interrupt(fiber);
			expect(yield* observer`select datname from pg_database where datname = ${name}`).toEqual([]);
		}),
	),
);

it("refuses unsafe destinations before opening a pool or resetting tables", () => {
	for (const url of [
		"postgresql://postgres:postgres@remote:55432/platform_test_effect_sql",
		"postgresql://postgres:postgres@127.0.0.1:55432/production",
		"postgresql://postgres:postgres@127.0.0.1:5432/platform_test_effect_sql",
		"postgresql://postgres:postgres@127.0.0.1:55432/platform_test_effect_sql?host=remote",
	]) {
		expect(() => disposableDestination(url)).toThrow("Use a local database");
	}
});

integration("overlapping stories serialize resets so one story cannot erase another story's committed rows", () =>
	run(
		Effect.gen(function* () {
			const database = yield* acquireDatabase;
			const sql = database.sql;
			const story = isolate(wholeStack);
			const first = story(
				Effect.gen(function* () {
					yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'First', 1)`;
					yield* Effect.sleep("100 millis");
					expect(yield* database.observer`select name from orders`).toEqual([{ name: "First" }]);
				}),
			);
			const second = story(
				Effect.gen(function* () {
					expect(yield* database.observer`select name from orders`).toEqual([]);
					yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'Second', 2)`;
					expect(yield* database.observer`select name from orders`).toEqual([{ name: "Second" }]);
				}),
			);
			yield* Effect.all([first, second], { concurrency: "unbounded" }).pipe(Effect.provideService(StoryDatabase, database));
			expect(yield* database.observer`select name from orders`).toEqual([]);
		}),
	),
);
