import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { assertModelColumns } from "#assertModelColumns.ts";
import { PostgresTestDatabase } from "#database.ts";
import type { PostgresColumn } from "#migrationUpgrade.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { createDatabaseEngine } from "./databaseEngine.ts";
import { failureOf } from "./outcome.ts";
import { adminUrl, configured } from "./postgres.ts";

class NamedRow extends Model.Class<NamedRow>("NamedRow")({ id: Schema.Int, runId: Schema.String }) {}

export type SchemaChange = "dropping run_id" | "changing run_id's type" | "adding extra_field" | 'renaming run_id to "runId"';

const schemaChanges: Record<SchemaChange, (sql: SqlClient.SqlClient) => Effect.Effect<unknown, unknown>> = {
	"adding extra_field": (sql) => sql`alter table named_rows add column extra_field boolean`,
	"changing run_id's type": (sql) => sql`alter table named_rows alter column ${sql("runId")} type varchar(8)`,
	"dropping run_id": (sql) => sql`alter table named_rows drop column ${sql("runId")}`,
	'renaming run_id to "runId"': (sql) => sql`alter table named_rows rename column run_id to "runId"`,
};

export type Client = "the shared database" | "an isolated block" | "an explicit clone";

const readRows = Effect.gen(function* () {
	const rows = yield* makeRepository(NamedRow, { idColumn: "id", spanPrefix: "NamedRow", tableName: "named_rows" });
	return yield* rows.findMany({ where: { runId: "seed" } });
});

const checkColumns = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const columns = yield* sql<PostgresColumn>`select attname as name, format_type(atttypid, atttypmod) as type
		from pg_attribute where attrelid = 'named_rows'::regclass and attnum > 0 and not attisdropped`.withoutTransform;
	return yield* assertModelColumns(columns, NamedRow, { id: "integer", runId: "text" }).pipe(
		Effect.as("matches the model"),
		Effect.catchTag("ModelColumnMismatch", (mismatch) => Effect.succeed(failureOf(mismatch))),
	);
});

function migrations(mapped: boolean) {
	return {
		loader: Migrator.fromRecord({
			"1_named_rows": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* mapped
					? sql`create table named_rows (id integer primary key, run_id text not null)`
					: sql`create table named_rows (id integer primary key, "runId" text not null)`;
			}),
		}),
		lockTimeout: "5 seconds" as const,
	};
}

export const names = storyKit({
	after: {
		configuration: (engine) => {
			const mapped = engine.options.transformQueryNames !== undefined;
			const { initialize, ...options } = engine.options;
			engine.options = {
				...options,
				fixtures: Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					yield* sql`insert into named_rows ${sql.insert({ id: 1, runId: "seed" })}`;
				}),
				migrations: migrations(mapped),
			};
			return engine.lease();
		},
	},
	clock: "live",
	create: () =>
		Effect.map(createDatabaseEngine, (engine) => {
			engine.options = clientOptions(engine.options, { snakeCase: true });
			return engine;
		}),
	inspect: (engine) => ({ template: engine.template }),
	layer: PgClient.layer({ url: adminUrl }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "test client SQL names",
	runIf: configured,
	stages: ["configuration"],
	verbs: (engine, story) => {
		function run<A, E, R>(client: Client, effect: Effect.Effect<A, E, R>) {
			if (client === "the shared database") {
				return engine.run(effect);
			}
			if (client === "an isolated block") {
				return engine.run(withIsolatedDatabase(effect));
			}
			return engine.run(
				Effect.scoped(
					Effect.gen(function* () {
						const database = yield* PostgresTestDatabase;
						const services = yield* database.clone("migrated");
						return yield* effect.pipe(Effect.provideContext(services));
					}),
				),
			);
		}
		return {
			changeSchema: (change: SchemaChange) => {
				story.tell(`the shared database's schema changes by ${change}`);
				return engine.run(Effect.flatMap(SqlClient.SqlClient, schemaChanges[change]));
			},
			columnCheck: (client: Client) => run(client, checkColumns),
			rows: (client: Client) => run(client, readRows),
		};
	},
});

export const unmapped = names.trait("configuration", "the app preserves SQL names, so the column is named runId", (engine) => {
	const { transformQueryNames, transformResultNames, ...options } = engine.options;
	engine.options = clientOptions(options, { snakeCase: false });
});
