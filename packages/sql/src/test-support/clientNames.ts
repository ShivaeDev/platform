import { Effect, Schema } from "effect";
import { identity } from "effect/Function";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clientOptions } from "#clientOptions.ts";
import { migratePostgres } from "#migrations.ts";
import { postgresLayer } from "#postgresLayer.ts";
import { makeRepository } from "#repository.ts";
import { configured, postgresOptions } from "./postgres.ts";

class DatedRow extends Model.Class<DatedRow>("DatedRow")({
	createdAt: Schema.Date,
	id: Schema.Int,
}) {}

const datedRows = Effect.fnUntraced(function* (column: string) {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_names_${crypto.randomUUID().replaceAll("-", "")}`;
	const ledger = `${tableName}_migrations`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}, ${sql(ledger)}`.pipe(Effect.orDie));
	yield* migratePostgres({
		loader: Migrator.fromRecord({
			"1_create_dated_rows": sql`create table ${sql(tableName)} (id integer primary key, ${sql(column)} timestamptz not null)`,
		}),
		lockTimeout: "5 seconds",
		table: ledger,
	});
	const rows = yield* makeRepository(DatedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "DatedRow", tableName });
	return {
		rows,
		seed: (createdAt: Date) => sql`insert into ${sql(tableName)} (id, ${sql(column)}) values (1, ${createdAt})`,
		sql,
		tableName,
	};
});

export const mapped = storyKit({
	clock: "live",
	create: () => datedRows("created_at"),
	layer: postgresLayer(postgresOptions.url, clientOptions(postgresOptions)),
	name: "snake_case SQL names",
	runIf: configured,
	stages: ["rows"],
	verbs: (engine) => engine,
});

export const preserved = storyKit({
	clock: "live",
	create: () => datedRows("createdAt"),
	layer: postgresLayer(postgresOptions.url, clientOptions(postgresOptions, { snakeCase: false })),
	name: "preserved SQL names",
	runIf: configured,
	stages: [],
	verbs: (engine) => engine,
});

export const customized = storyKit({
	clock: "live",
	create: () => datedRows("createdAt"),
	layer: postgresLayer(postgresOptions.url, clientOptions({ ...postgresOptions, transformQueryNames: identity, transformResultNames: identity })),
	name: "custom SQL names",
	runIf: configured,
	stages: [],
	verbs: (engine) => engine,
});

export function createdRow(createdAt: Date) {
	return mapped.trait("rows", "a dated row exists in PostgreSQL", ({ seed }) => seed(createdAt));
}
