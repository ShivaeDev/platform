import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Deferred, Effect, Exit, Fiber, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";
import { migratePostgres } from "#migrations.ts";
import { environmentVariable } from "#test/support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;
const migrate = (options: { readonly table: string; readonly loader: Migrator.Loader<SqlClient.SqlClient> }) =>
	migratePostgres({ ...options, lockTimeout: "5 seconds" });

function blockedBy(holder: number) {
	return Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		while (true) {
			const waiting = yield* sql<{ waiting: boolean }>`select exists (
				select 1 from pg_stat_activity where ${holder} = any(pg_blocking_pids(pid))
			) as waiting`;
			if (waiting[0]?.waiting) {
				return;
			}
			yield* Effect.sleep("10 millis");
		}
	});
}

const withDatabase = <A, E>(use: (names: { ledger: string; orders: string; audit: string }) => Effect.Effect<A, E, SqlClient.SqlClient>) =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const prefix = `pm_${crypto.randomUUID().replaceAll("-", "")}`;
				const names = {
					audit: `${prefix}_audit`,
					ledger: `${prefix}_ledger`,
					orders: `${prefix}_orders`,
				};
				yield* Effect.addFinalizer(() =>
					Effect.gen(function* () {
						for (const name of [names.audit, names.orders, names.ledger]) {
							yield* sql`drop table if exists ${sql(name)}`;
						}
					}).pipe(Effect.orDie),
				);
				return yield* use(names);
			}),
		).pipe(
			Effect.provide(
				PgClient.layer({
					maxConnections: 4,
					url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
				}),
			),
		),
	);

integration("migratePostgres initializes, upgrades and reruns without repeating writes", async () => {
	await withDatabase(({ ledger, orders }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const initial = {
				"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
			};
			expect(
				yield* migrate({
					loader: Migrator.fromRecord(initial),
					table: ledger,
				}),
			).toEqual([[1, "create_orders"]]);
			const loader = Migrator.fromRecord({
				"2_seed_orders": sql`insert into ${sql(orders)} (name) values ('Printer paper')`.pipe(Effect.asVoid),
				...initial,
			});
			expect(yield* migrate({ loader, table: ledger })).toEqual([[2, "seed_orders"]]);
			expect(yield* migrate({ loader, table: ledger })).toEqual([]);
			expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "Printer paper" }]);
			expect(yield* sql`select migration_id, name from ${sql(ledger)} order by migration_id`).toEqual([
				{ migration_id: 1, name: "create_orders" },
				{ migration_id: 2, name: "seed_orders" },
			]);
		}),
	);
});

integration("migratePostgres rolls back pending DDL, data and ledger as one batch", async () => {
	await withDatabase(({ ledger, orders, audit }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const initial = {
				"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
			};
			yield* migrate({ loader: Migrator.fromRecord(initial), table: ledger });
			const exit = yield* migrate({
				loader: Migrator.fromRecord({
					...initial,
					"2_add_audit_and_seed": Effect.gen(function* () {
						yield* sql`create table ${sql(audit)} (name text)`;
						yield* sql`insert into ${sql(orders)} (name) values ('Printer paper')`;
					}),
					"3_duplicate_order": sql`insert into ${sql(orders)} (name) values ('Printer paper')`.pipe(Effect.asVoid),
				}),
				table: ledger,
			}).pipe(Effect.exit);
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.hasDies(exit.cause)).toBe(true);
				expect(Cause.squash(exit.cause)).toMatchObject({
					_tag: "MigrationError",
					kind: "Failed",
				});
			}
			expect(yield* sql`select name from ${sql(orders)}`).toEqual([]);
			expect(yield* sql`select to_regclass(${audit}) as table_name`).toEqual([{ table_name: null }]);
			expect(yield* sql`select migration_id from ${sql(ledger)}`).toEqual([{ migration_id: 1 }]);
		}),
	);
});

integration(
	"migratePostgres serializes upgrades on an existing ledger and applies each migration once",
	async () => {
		await withDatabase(({ ledger, orders }) =>
			Effect.scoped(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const initial = {
						"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
					};
					yield* migrate({
						loader: Migrator.fromRecord(initial),
						table: ledger,
					});
					const entered = yield* Deferred.make<number>();
					const release = yield* Deferred.make<void>();
					const loader = Migrator.fromRecord({
						...initial,
						"2_seed_orders": Effect.gen(function* () {
							const [backend] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
							yield* Deferred.succeed(entered, backend?.pid ?? 0);
							yield* Deferred.await(release);
							yield* sql`insert into ${sql(orders)} (name) values ('Printer paper')`;
						}),
					});
					const first = yield* migrate({ loader, table: ledger }).pipe(Effect.forkScoped);
					const holder = yield* Deferred.await(entered).pipe(Effect.timeout("5 seconds"));
					const second = yield* migrate({ loader, table: ledger }).pipe(Effect.forkScoped);
					yield* blockedBy(holder).pipe(Effect.timeout("5 seconds"));
					yield* Deferred.succeed(release, undefined);
					expect(yield* Fiber.join(first)).toEqual([[2, "seed_orders"]]);
					expect(yield* Fiber.join(second)).toEqual([]);
					expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "Printer paper" }]);
					expect(yield* sql`select migration_id from ${sql(ledger)} order by migration_id`).toEqual([{ migration_id: 1 }, { migration_id: 2 }]);
				}),
			),
		);
	},
	15_000,
);
