import { Cause, Duration, Effect, Exit, Fiber } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasHeldSeed, hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it(
	"migratePostgres serializes empty-database runners and applies each migration once",
	[hasMigrationTables(), hasHeldSeed()],
	function* ({ migrations, sql, migratePostgres, heldSeed, waitingOn }) {
		const { ledger, orders } = migrations();

		const held = heldSeed();
		const options = {
			loader: held.loader,
			lockTimeout: "5 seconds",
			table: ledger,
		} as const;
		const first = yield* migratePostgres(options).pipe(Effect.forkScoped);
		const holder = yield* held.entered;
		const second = yield* migratePostgres(options).pipe(Effect.forkScoped);
		yield* eventually(waitingOn(holder).pipe(Effect.flatMap((waiting) => Effect.try(() => expect(waiting).toBe(true))))).pipe(
			Effect.timeout("5 seconds"),
		);
		yield* held.release;
		expect(yield* Fiber.join(first)).toEqual([
			[1, "create_orders"],
			[2, "seed_orders"],
		]);
		expect(yield* Fiber.join(second)).toEqual([]);
		expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "Printer paper" }]);
		expect(yield* sql`select migration_id from ${sql(ledger)} order by migration_id`).toEqual([{ "migration_id": 1 }, { "migration_id": 2 }]);
	},
	15_000,
);

postgres.it(
	"migratePostgres fails with a typed lock timeout while another runner holds the migration lock",
	[hasMigrationTables(), hasHeldSeed()],
	function* ({ migrations, migratePostgres, heldSeed }) {
		const { ledger } = migrations();

		const held = heldSeed();
		const first = yield* migratePostgres({
			loader: held.loader,
			lockTimeout: "5 seconds",
			table: ledger,
		}).pipe(Effect.forkScoped);
		yield* held.entered;
		const blocked = yield* migratePostgres({
			loader: held.loader,
			lockTimeout: "100 millis",
			table: ledger,
		}).pipe(Effect.timeout("3 seconds"), Effect.flip);
		expect(blocked).toMatchObject({
			_tag: "SqlError",
			reason: { _tag: "LockTimeoutError" },
		});
		yield* held.release;
		expect(yield* Fiber.join(first)).toEqual([
			[1, "create_orders"],
			[2, "seed_orders"],
		]);
	},
	15_000,
);

postgres.it(
	"a failed migratePostgres batch rolls back the bootstrapped ledger with the batch",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres }) {
		const { ledger, orders } = migrations();

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
	},
);

postgres.it(
	"an infinite migratePostgres lock timeout disables PostgreSQL's lock timeout for the batch",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres }) {
		const { ledger } = migrations();

		const seen: Array<string | undefined> = [];
		const applied = yield* migratePostgres({
			loader: Migrator.fromRecord({
				"1_read_lock_timeout": Effect.map(
					sql<{
						timeout: string;
					}>`select current_setting('lock_timeout') as timeout`,
					([row]) => {
						seen.push(row?.timeout);
					},
				),
			}),
			lockTimeout: Duration.infinity,
			table: ledger,
		});
		expect(applied).toEqual([[1, "read_lock_timeout"]]);
		expect(seen).toEqual(["0"]);
	},
);
