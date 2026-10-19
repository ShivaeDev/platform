import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { clientOptions } from "@shivaedev/effect-sql/clientOptions.ts";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { assertModelColumns } from "#assertModelColumns.ts";
import { PostgresTestDatabase } from "#database.ts";
import type { PostgresColumn } from "#migrationUpgrade.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { createDatabaseEngine } from "./databaseEngine.ts";
import { adminUrl, configured } from "./postgres.ts";

class NamedRow extends Model.Class<NamedRow>("NamedRow")({ id: Schema.Int, runId: Schema.String }) {}

type Client = "shared" | "isolated" | "clone";

const readRows = Effect.gen(function* () {
	const rows = yield* makeRepository(NamedRow, { idColumn: "id", spanPrefix: "NamedRow", tableName: "named_rows" });
	return yield* rows.findMany({ where: { runId: "seed" } });
});

const checkColumns = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const columns = yield* sql<PostgresColumn>`select attname as name, format_type(atttypid, atttypmod) as type
		from pg_attribute where attrelid = 'named_rows'::regclass and attnum > 0 and not attisdropped`.withoutTransform;
	return yield* assertModelColumns(columns, NamedRow, { id: "integer", runId: "text" });
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
			engine.options = {
				...engine.options,
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
			story.tell(`use the ${client} client`);
			if (client === "shared") {
				return engine.run(effect);
			}
			if (client === "isolated") {
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
			addColumn: () => engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`alter table named_rows add column extra_field boolean`)),
			changeRunIdType: () =>
				engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`alter table named_rows alter column ${sql("runId")} type varchar(8)`)),
			checkColumns: (client: Client) => run(client, checkColumns),
			dropRunId: () => engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`alter table named_rows drop column ${sql("runId")}`)),
			readRows: (client: Client) => run(client, readRows),
			renameRunId: () => engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`alter table named_rows rename column run_id to "runId"`)),
		};
	},
});

export const unmapped = names.trait("configuration", "the app preserves SQL names", (engine) => {
	const { transformQueryNames, transformResultNames, ...options } = engine.options;
	engine.options = clientOptions(options, { snakeCase: false });
});
