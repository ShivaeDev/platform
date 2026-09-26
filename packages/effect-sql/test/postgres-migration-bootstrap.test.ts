import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Deferred, Duration, Effect, Exit, Fiber, Redacted, type Scope } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";
import { migratePostgres } from "../src/index.ts";
import { environmentVariable } from "./support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;
const migrate = Migrator.make({});

class Rollback {
	readonly _tag = "Rollback";
}

const withDatabase = <A, E>(use: (names: { ledger: string; foods: string }) => Effect.Effect<A, E, SqlClient.SqlClient | Scope.Scope>) =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const prefix = `pb_${crypto.randomUUID().replaceAll("-", "")}`;
				const names = { ledger: `${prefix}_ledger`, foods: `${prefix}_foods` };
				yield* Effect.addFinalizer(() =>
					Effect.gen(function* () {
						for (const name of [names.foods, names.ledger]) {
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
					maxConnections: 6,
				}),
			),
		),
	);

const waitUntil = (condition: Effect.Effect<boolean, unknown, SqlClient.SqlClient>) =>
	Effect.gen(function* () {
		while (!(yield* condition)) yield* Effect.sleep("10 millis");
	}).pipe(Effect.timeout("5 seconds"));

const holdUncommittedLedger = (ledger: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const created = yield* Deferred.make<number>();
		const release = yield* Deferred.make<void>();
		const holder = yield* sql
			.withTransaction(
				Effect.gen(function* () {
					yield* sql`create table ${sql(ledger)} (migration_id integer primary key, created_at timestamptz not null default now(), name text not null)`;
					const [row] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
					yield* Deferred.succeed(created, row?.pid ?? 0);
					yield* Deferred.await(release);
					return yield* Effect.fail(new Rollback());
				}),
			)
			.pipe(Effect.exit, Effect.forkScoped);
		const pid = yield* Deferred.await(created).pipe(Effect.timeout("5 seconds"));
		const blockedBehind = (count: number) =>
			waitUntil(
				Effect.map(
					sql<{ blocked: number }>`select count(*)::int as blocked from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid))`,
					(rows) => rows[0]?.blocked === count,
				),
			);
		const rollback = Deferred.succeed(release, undefined).pipe(Effect.andThen(Fiber.join(holder)));
		return { blockedBehind, rollback };
	});

integration(
	"native Migrator loses the empty-database bootstrap race with a typed SqlError",
	async () => {
		await withDatabase(({ ledger, foods }) =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const loader = Migrator.fromRecord({
					"1_create_foods": sql`create table ${sql(foods)} (name text primary key)`.pipe(Effect.asVoid),
				});
				const holder = yield* holdUncommittedLedger(ledger);
				const first = yield* migrate({ table: ledger, loader }).pipe(Effect.exit, Effect.forkScoped);
				const second = yield* migrate({ table: ledger, loader }).pipe(Effect.exit, Effect.forkScoped);
				yield* holder.blockedBehind(2);
				yield* holder.rollback;
				const exits = [yield* Fiber.join(first), yield* Fiber.join(second)];
				expect(exits.filter(Exit.isSuccess).map((exit) => exit.value)).toEqual([[[1, "create_foods"]]]);
				const failures = exits.filter(Exit.isFailure).map((exit) => exit.cause);
				expect(failures).toHaveLength(1);
				expect(failures.map((cause) => [Cause.hasDies(cause), Cause.squash(cause)])).toMatchObject([
					[false, { _tag: "SqlError", reason: { _tag: "UniqueViolation" } }],
				]);
				expect(yield* sql`select migration_id from ${sql(ledger)}`).toEqual([{ migration_id: 1 }]);
			}),
		);
	},
	15_000,
);

const heldSeed = (foods: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const loader = Migrator.fromRecord({
			"1_create_foods": sql`create table ${sql(foods)} (name text primary key)`.pipe(Effect.asVoid),
			"2_seed_foods": Effect.gen(function* () {
				yield* Deferred.succeed(entered, undefined);
				yield* Deferred.await(release);
				yield* sql`insert into ${sql(foods)} (name) values ('Apple')`;
			}),
		});
		const advisoryWaiter = waitUntil(
			Effect.map(
				sql<{ waiting: boolean }>`select exists (select 1 from pg_locks where locktype = 'advisory' and not granted) as waiting`,
				(rows) => rows[0]?.waiting === true,
			),
		);
		return {
			loader,
			entered: Deferred.await(entered).pipe(Effect.timeout("5 seconds")),
			release: Deferred.succeed(release, undefined),
			advisoryWaiter,
		};
	});

integration(
	"migratePostgres serializes empty-database runners and applies each migration once",
	async () => {
		await withDatabase(({ ledger, foods }) =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const held = yield* heldSeed(foods);
				const options = { table: ledger, loader: held.loader, lockTimeout: "5 seconds" } as const;
				const first = yield* migratePostgres(options).pipe(Effect.forkScoped);
				yield* held.entered;
				const second = yield* migratePostgres(options).pipe(Effect.forkScoped);
				yield* held.advisoryWaiter;
				yield* held.release;
				expect(yield* Fiber.join(first)).toEqual([
					[1, "create_foods"],
					[2, "seed_foods"],
				]);
				expect(yield* Fiber.join(second)).toEqual([]);
				expect(yield* sql`select name from ${sql(foods)}`).toEqual([{ name: "Apple" }]);
				expect(yield* sql`select migration_id from ${sql(ledger)} order by migration_id`).toEqual([{ migration_id: 1 }, { migration_id: 2 }]);
			}),
		);
	},
	15_000,
);

integration(
	"migratePostgres fails with a typed lock timeout while another runner holds the migration lock",
	async () => {
		await withDatabase(({ ledger, foods }) =>
			Effect.gen(function* () {
				const held = yield* heldSeed(foods);
				const first = yield* migratePostgres({ table: ledger, loader: held.loader, lockTimeout: "5 seconds" }).pipe(Effect.forkScoped);
				yield* held.entered;
				const blocked = yield* migratePostgres({ table: ledger, loader: held.loader, lockTimeout: "100 millis" }).pipe(
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
	await withDatabase(({ ledger, foods }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const exit = yield* migratePostgres({
				table: ledger,
				lockTimeout: "5 seconds",
				loader: Migrator.fromRecord({
					"1_create_foods": sql`create table ${sql(foods)} (name text primary key)`.pipe(Effect.asVoid),
					"2_duplicate_food": sql`insert into ${sql(foods)} (name) values ('Apple'), ('Apple')`.pipe(Effect.asVoid),
				}),
			}).pipe(Effect.exit);
			expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
			expect(yield* sql`select to_regclass(${ledger}) as ledger, to_regclass(${foods}) as foods`).toEqual([{ ledger: null, foods: null }]);
		}),
	);
});

integration("an infinite migratePostgres lock timeout disables PostgreSQL's lock timeout for the batch", async () => {
	await withDatabase(({ ledger }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const seen: Array<string | undefined> = [];
			const applied = yield* migratePostgres({
				table: ledger,
				lockTimeout: Duration.infinity,
				loader: Migrator.fromRecord({
					"1_read_lock_timeout": Effect.map(sql<{ timeout: string }>`select current_setting('lock_timeout') as timeout`, ([row]) => {
						seen.push(row?.timeout);
					}),
				}),
			});
			expect(applied).toEqual([[1, "read_lock_timeout"]]);
			expect(seen).toEqual(["0"]);
		}),
	);
});

integration(
	"concurrent migratePostgres runners never race the ledger bootstrap",
	async () => {
		await withDatabase(({ ledger }) =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const loader = Migrator.fromRecord({ "1_noop": Effect.void });
				for (let round = 0; round < 20; round++) {
					const table = `${ledger}_${round}`;
					const results = yield* Effect.all(
						Array.from({ length: 4 }, () => migratePostgres({ table, loader, lockTimeout: "5 seconds" })),
						{ concurrency: "unbounded" },
					);
					expect(results.filter((applied) => applied.length > 0)).toEqual([[[1, "noop"]]]);
					yield* sql`drop table ${sql(table)}`;
				}
			}),
		);
	},
	30_000,
);
