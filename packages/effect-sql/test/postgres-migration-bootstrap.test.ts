import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Deferred, Duration, Effect, Exit, Fiber, Redacted, type Scope } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";
import { migratePostgres } from "#migrations.ts";
import { environmentVariable } from "#test/support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;

const withDatabase = <A, E>(use: (names: { ledger: string; orders: string }) => Effect.Effect<A, E, SqlClient.SqlClient | Scope.Scope>) =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const prefix = `pb_${crypto.randomUUID().replaceAll("-", "")}`;
				const names = { ledger: `${prefix}_ledger`, orders: `${prefix}_orders` };
				yield* Effect.addFinalizer(() =>
					Effect.gen(function* () {
						for (const name of [names.orders, names.ledger]) {
							yield* sql`drop table if exists ${sql(name)}`;
						}
					}).pipe(Effect.orDie),
				);
				return yield* use(names);
			}),
		).pipe(
			Effect.provide(
				PgClient.layer({
					maxConnections: 6,
					url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
				}),
			),
		),
	);

const waitUntil = (condition: Effect.Effect<boolean, unknown, SqlClient.SqlClient>) =>
	Effect.gen(function* () {
		while (!(yield* condition)) {
			yield* Effect.sleep("10 millis");
		}
	}).pipe(Effect.timeout("5 seconds"));

const heldSeed = (orders: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const entered = yield* Deferred.make<number>();
		const release = yield* Deferred.make<void>();
		const loader = Migrator.fromRecord({
			"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
			"2_seed_orders": Effect.gen(function* () {
				const [backend] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
				yield* Deferred.succeed(entered, backend?.pid ?? 0);
				yield* Deferred.await(release);
				yield* sql`insert into ${sql(orders)} (name) values ('Printer paper')`;
			}),
		});
		const waiting = Effect.gen(function* () {
			const holder = yield* Deferred.await(entered);
			yield* waitUntil(
				Effect.map(
					sql<{ waiting: boolean }>`select exists (select 1 from pg_stat_activity where ${holder} = any(pg_blocking_pids(pid))) as waiting`,
					(rows) => rows[0]?.waiting === true,
				),
			);
		});
		return {
			entered: Deferred.await(entered).pipe(Effect.timeout("5 seconds")),
			loader,
			release: Deferred.succeed(release, undefined),
			waiting,
		};
	});

integration(
	"migratePostgres serializes empty-database runners and applies each migration once",
	async () => {
		await withDatabase(({ ledger, orders }) =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const held = yield* heldSeed(orders);
				const options = { loader: held.loader, lockTimeout: "5 seconds", table: ledger } as const;
				const first = yield* migratePostgres(options).pipe(Effect.forkScoped);
				yield* held.entered;
				const second = yield* migratePostgres(options).pipe(Effect.forkScoped);
				yield* held.waiting;
				yield* held.release;
				expect(yield* Fiber.join(first)).toEqual([
					[1, "create_orders"],
					[2, "seed_orders"],
				]);
				expect(yield* Fiber.join(second)).toEqual([]);
				expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "Printer paper" }]);
				expect(yield* sql`select migration_id from ${sql(ledger)} order by migration_id`).toEqual([{ migration_id: 1 }, { migration_id: 2 }]);
			}),
		);
	},
	15_000,
);

integration(
	"migratePostgres fails with a typed lock timeout while another runner holds the migration lock",
	async () => {
		await withDatabase(({ ledger, orders }) =>
			Effect.gen(function* () {
				const held = yield* heldSeed(orders);
				const first = yield* migratePostgres({ loader: held.loader, lockTimeout: "5 seconds", table: ledger }).pipe(Effect.forkScoped);
				yield* held.entered;
				const blocked = yield* migratePostgres({ loader: held.loader, lockTimeout: "100 millis", table: ledger }).pipe(
					Effect.timeout("3 seconds"),
					Effect.flip,
				);
				expect(blocked).toMatchObject({ _tag: "SqlError", reason: { _tag: "LockTimeoutError" } });
				yield* held.release;
				expect(yield* Fiber.join(first)).toHaveLength(2);
			}),
		);
	},
	15_000,
);

integration("a failed migratePostgres batch rolls back the bootstrapped ledger with the batch", async () => {
	await withDatabase(({ ledger, orders }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const exit = yield* migratePostgres({
				loader: Migrator.fromRecord({
					"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
					"2_duplicate_order": sql`insert into ${sql(orders)} (name) values ('Printer paper'), ('Printer paper')`.pipe(Effect.asVoid),
				}),
				lockTimeout: "5 seconds",
				table: ledger,
			}).pipe(Effect.exit);
			expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
			expect(yield* sql`select to_regclass(${ledger}) as ledger, to_regclass(${orders}) as orders`).toEqual([{ ledger: null, orders: null }]);
		}),
	);
});

integration("an infinite migratePostgres lock timeout disables PostgreSQL's lock timeout for the batch", async () => {
	await withDatabase(({ ledger }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const seen: Array<string | undefined> = [];
			const applied = yield* migratePostgres({
				loader: Migrator.fromRecord({
					"1_read_lock_timeout": Effect.map(sql<{ timeout: string }>`select current_setting('lock_timeout') as timeout`, ([row]) => {
						seen.push(row?.timeout);
					}),
				}),
				lockTimeout: Duration.infinity,
				table: ledger,
			});
			expect(applied).toEqual([[1, "read_lock_timeout"]]);
			expect(seen).toEqual(["0"]);
		}),
	);
});
