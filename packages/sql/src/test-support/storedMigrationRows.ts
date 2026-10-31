import { Effect, Schema } from "effect";
import { Migrator } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migratePostgres } from "#migrations.ts";
import { pendingPostgresMigrations } from "#pendingPostgresMigrations.ts";
import { readPostgresRelease } from "#postgresRelease.ts";
import { releaseWorkers } from "#releaseWorkers.ts";
import { onPostgres } from "./engines.ts";
import { migrationEngine } from "./migrationEngine.ts";

function checked<R>(effect: Effect.Effect<unknown, unknown, R>) {
	return effect.pipe(
		Effect.as("accepted the stored row"),
		Effect.catchIf(Schema.isSchemaError, () => Effect.succeed("refused the stored row")),
	);
}

const loader = Migrator.fromRecord({ "1_first": Effect.void });

export const storedMigrationRows = storyKit({
	...onPostgres,
	create: migrationEngine,
	name: "stored migration rows",
	stages: ["schema"],
	verbs: ({ tables: { ledger } }) => ({
		checkReadiness: () => checked(pendingPostgresMigrations({ loader, table: ledger })),
		checkReleaseReadiness: () => checked(pendingPostgresMigrations({ loader: Migrator.fromRecord({}), release: "first", table: ledger })),
		claimRelease: () => checked(Effect.flatMap(releaseWorkers("first", 5000, ledger), (worker) => worker.claim)),
		migrate: () => checked(migratePostgres({ loader, lockTimeout: "5 seconds", table: ledger })),
		readRelease: () => checked(readPostgresRelease(ledger)),
	}),
});

export function malformedLedger() {
	return storedMigrationRows.trait("schema", "the ledger stores a migration id that is not a number", function* ({ sql, tables: { ledger } }) {
		yield* sql`create table ${sql(ledger)} (migration_id text primary key, created_at timestamptz not null default now(), name text not null)`;
		yield* sql`insert into ${sql(ledger)} (migration_id, name) values ('invalid', 'first')`;
	});
}

export function malformedRelease(column: "release" | "recorded_at") {
	return storedMigrationRows.trait("schema", `the release marker stores an invalid ${column}`, function* ({ sql, tables: { ledger } }) {
		const table = `${ledger}_release`;
		if (column === "release") {
			yield* sql`create table ${sql(table)} (id boolean primary key, release integer, recorded_at timestamptz)`;
			yield* sql`insert into ${sql(table)} values (true, 42, clock_timestamp())`;
		} else {
			yield* sql`create table ${sql(table)} (id boolean primary key, release text, recorded_at text)`;
			yield* sql`insert into ${sql(table)} values (true, 'first', 'invalid')`;
		}
	});
}
