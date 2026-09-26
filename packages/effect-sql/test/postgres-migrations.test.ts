import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Deferred, Effect, Exit, Fiber, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";
import { environmentVariable } from "./support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;
const migrate = Migrator.make({});

const withDatabase = <A, E>(use: (names: { ledger: string; foods: string; audit: string }) => Effect.Effect<A, E, SqlClient.SqlClient>) =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const prefix = `pm_${crypto.randomUUID().replaceAll("-", "")}`;
				const names = {
					ledger: `${prefix}_ledger`,
					foods: `${prefix}_foods`,
					audit: `${prefix}_audit`,
				};
				yield* Effect.addFinalizer(() =>
					Effect.gen(function* () {
						for (const name of [names.audit, names.foods, names.ledger]) {
							yield* sql`drop table if exists ${sql(name)}`;
						}
					}).pipe(Effect.orDie),
				);
				return yield* use(names);
			}),
		).pipe(
			Effect.provide(
				PgClient.layer({
					url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
					maxConnections: 4,
				}),
			),
		),
	);

integration("PostgreSQL migrations initialize, upgrade and rerun without repeating writes", async () => {
	await withDatabase(({ ledger, foods }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const initial = {
				"1_create_foods": sql`create table ${sql(foods)} (name text primary key)`.pipe(Effect.asVoid),
			};
			expect(
				yield* migrate({
					table: ledger,
					loader: Migrator.fromRecord(initial),
				}),
			).toEqual([[1, "create_foods"]]);
			const loader = Migrator.fromRecord({
				"2_seed_foods": sql`insert into ${sql(foods)} (name) values ('Apple')`.pipe(Effect.asVoid),
				...initial,
			});
			expect(yield* migrate({ table: ledger, loader })).toEqual([[2, "seed_foods"]]);
			expect(yield* migrate({ table: ledger, loader })).toEqual([]);
			expect(yield* sql`select name from ${sql(foods)}`).toEqual([{ name: "Apple" }]);
			expect(yield* sql`select migration_id, name from ${sql(ledger)} order by migration_id`).toEqual([
				{ migration_id: 1, name: "create_foods" },
				{ migration_id: 2, name: "seed_foods" },
			]);
		}),
	);
});

integration("PostgreSQL rolls back pending migration DDL, data and ledger as one batch", async () => {
	await withDatabase(({ ledger, foods, audit }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const initial = {
				"1_create_foods": sql`create table ${sql(foods)} (name text primary key)`.pipe(Effect.asVoid),
			};
			yield* migrate({ table: ledger, loader: Migrator.fromRecord(initial) });
			const exit = yield* migrate({
				table: ledger,
				loader: Migrator.fromRecord({
					...initial,
					"2_add_audit_and_seed": Effect.gen(function* () {
						yield* sql`create table ${sql(audit)} (name text)`;
						yield* sql`insert into ${sql(foods)} (name) values ('Apple')`;
					}),
					"3_duplicate_food": sql`insert into ${sql(foods)} (name) values ('Apple')`.pipe(Effect.asVoid),
				}),
			}).pipe(Effect.exit);
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.hasDies(exit.cause)).toBe(true);
				expect(Cause.squash(exit.cause)).toMatchObject({
					_tag: "MigrationError",
					kind: "Failed",
				});
			}
			expect(yield* sql`select name from ${sql(foods)}`).toEqual([]);
			expect(yield* sql`select to_regclass(${audit}) as table_name`).toEqual([{ table_name: null }]);
			expect(yield* sql`select migration_id from ${sql(ledger)}`).toEqual([{ migration_id: 1 }]);
		}),
	);
});

integration(
	"PostgreSQL concurrent runners wait on the existing ledger and apply each migration once",
	async () => {
		await withDatabase(({ ledger, foods }) =>
			Effect.scoped(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const initial = {
						"1_create_foods": sql`create table ${sql(foods)} (name text primary key)`.pipe(Effect.asVoid),
					};
					yield* migrate({
						table: ledger,
						loader: Migrator.fromRecord(initial),
					});
					const entered = yield* Deferred.make<void>();
					const release = yield* Deferred.make<void>();
					const loader = Migrator.fromRecord({
						...initial,
						"2_seed_foods": Effect.gen(function* () {
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(release);
							yield* sql`insert into ${sql(foods)} (name) values ('Apple')`;
						}),
					});
					const first = yield* migrate({ table: ledger, loader }).pipe(Effect.forkScoped);
					yield* Deferred.await(entered).pipe(Effect.timeout("5 seconds"));
					const second = yield* migrate({ table: ledger, loader }).pipe(Effect.forkScoped);
					yield* Effect.gen(function* () {
						while (true) {
							const waiting = yield* sql<{ waiting: boolean }>`select exists (
					select 1 from pg_locks where relation = ${ledger}::regclass
					and mode = 'AccessExclusiveLock' and not granted
				) as waiting`;
							if (waiting[0]?.waiting) return;
							yield* Effect.sleep("10 millis");
						}
					}).pipe(Effect.timeout("5 seconds"));
					yield* Deferred.succeed(release, undefined);
					expect(yield* Fiber.join(first)).toEqual([[2, "seed_foods"]]);
					expect(yield* Fiber.join(second)).toEqual([]);
					expect(yield* sql`select name from ${sql(foods)}`).toEqual([{ name: "Apple" }]);
					expect(yield* sql`select migration_id from ${sql(ledger)} order by migration_id`).toEqual([{ migration_id: 1 }, { migration_id: 2 }]);
				}),
			),
		);
	},
	15_000,
);
