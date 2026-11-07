import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makePostgresTestLayer } from "#server/postgres.ts";
import { tableColumns } from "#server/tableColumns.ts";
import { withIsolatedDatabase } from "#server/withIsolatedDatabase.ts";
import { adminUrl, configured } from "#test/postgres.ts";

export const columns = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => Effect.void,
	layer: makePostgresTestLayer(clientOptions({ initialize: Effect.void, prepare: false, url: adminUrl }, { snakeCase: true })),
	name: "table column readout without migrations",
	runIf: configured,
	stages: [],
	verbs: (_engine, story) => ({
		createQuotedTable: () => {
			story.tell("create a mixed-case Items table directly, without migrations");
			return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table "Items" ("displayName" varchar(30), run_id bigint)`);
		},
		createTable: () => {
			story.tell("create an items table directly, without a migration ledger");
			return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table items (unit_price numeric(10,2), removed boolean, id integer)`);
		},
		dropColumn: () => {
			story.tell("drop the removed column from items");
			return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`alter table items drop column removed`);
		},
		readColumns: (table: string) => {
			story.tell(`read the live columns of ${table}`);
			return tableColumns(table);
		},
	}),
});
