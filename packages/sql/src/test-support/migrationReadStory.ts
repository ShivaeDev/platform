import { Effect, Layer, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Migrator, SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migratePostgres } from "#migrations.ts";
import { pendingPostgresMigrations } from "#pendingPostgresMigrations.ts";
import { readPostgresRelease } from "#postgresRelease.ts";
import { releaseWorkers } from "#releaseWorkers.ts";
import { migrationTables } from "./migrationTables.ts";
import { configured, postgresLayer } from "./postgres.ts";

function checked<R>(effect: Effect.Effect<unknown, unknown, R>) {
	return effect.pipe(
		Effect.as("accepted stored row"),
		Effect.catchIf(Schema.isSchemaError, () => Effect.succeed("invalid stored row")),
	);
}

const migrationEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const { ledger } = yield* migrationTables;
	const loader = Migrator.fromRecord({ "1_first": Effect.void });
	return { ledger, loader, sql };
});

export const migrationReads = storyKit({
	create: migrationEngine,
	layer: Layer.merge(postgresLayer, Reactivity.layer),
	name: "migration row decoding",
	runIf: configured,
	stages: ["schema"],
	verbs: ({ ledger, loader }) => ({
		checkReadiness: () => checked(pendingPostgresMigrations({ loader, table: ledger })),
		checkReleaseReadiness: () => checked(pendingPostgresMigrations({ loader: Migrator.fromRecord({}), release: "first", table: ledger })),
		claimRelease: () => checked(Effect.flatMap(releaseWorkers("first", 5000, ledger), (worker) => worker.claim)),
		migrate: () => checked(migratePostgres({ loader, lockTimeout: "5 seconds", table: ledger })),
		readRelease: () => checked(readPostgresRelease(ledger)),
	}),
});

export function malformedLedger() {
	return migrationReads.trait("schema", "the ledger stores a nonnumeric migration id", function* ({ ledger, sql }) {
		yield* sql`create table ${sql(ledger)} (migration_id text primary key, created_at timestamptz not null default now(), name text not null)`;
		yield* sql`insert into ${sql(ledger)} (migration_id, name) values ('invalid', 'first')`;
	});
}

export function malformedRelease(column: "release" | "recorded_at") {
	return migrationReads.trait("schema", `the release marker stores an invalid ${column}`, function* ({ ledger, sql }) {
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
