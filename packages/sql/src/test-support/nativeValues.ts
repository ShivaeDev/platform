import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { int4Array } from "#int4Array.ts";
import { int8 } from "#int8.ts";
import { inValues } from "#inValues.ts";
import { onPostgres } from "./engines.ts";
import { attempt } from "./outcome.ts";
import { ownTable, uniqueTable } from "./writeTables.ts";

const Row = Schema.Struct({ id: int8(Schema.BigInt), label: Schema.String, values: int4Array(Schema.Array(Schema.Int)) });
const RestrictedRow = Schema.Struct({
	id: int8(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(0n))),
	values: int4Array(Schema.Array(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))),
});

const nativeEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("native_values");
	yield* ownTable(sql, table, sql`id int8 primary key, label text not null, values int4[] not null`);
	const insert = SqlSchema.void({ execute: (row) => sql`insert into ${sql(table)} ${sql.insert(row)}`, Request: Row });
	const list = SqlSchema.findAll({
		execute: ({ labels, qualified }) =>
			Effect.gen(function* () {
				const predicate = yield* inValues(qualified ? sql`item.${sql("label")}` : "label", labels);
				return yield* sql`select item.* from ${sql(table)} item where ${predicate} order by item.id`;
			}),
		Request: Schema.Struct({ labels: Schema.Array(Schema.String), qualified: Schema.Boolean }),
		Result: Row,
	});
	const restricted = SqlSchema.findAll({
		execute: () => sql`select id, values from ${sql(table)} order by id`,
		Request: Schema.Void,
		Result: RestrictedRow,
	});
	return { insert, list, restricted };
});

export const nativeValues = storyKit({
	...onPostgres,
	create: nativeEngine,
	name: "native SQL values",
	stages: ["rows"],
	verbs: ({ list, restricted }, story) => ({
		list: (labels: readonly string[], qualified: boolean) => {
			story.tell(`native SqlSchema reads labels ${JSON.stringify(labels)} using ${qualified ? "a qualified column" : "a column name"}`);
			return list({ labels, qualified });
		},
		restrictedRows: () => {
			story.tell("native SqlSchema reads rows through nonnegative bigint and integer-array field schemas");
			return attempt(restricted());
		},
	}),
});

export function nativeRows(rows: readonly (typeof Row.Type)[]) {
	return nativeValues.trait("rows", `stored rows are ${rows.map(({ label }) => JSON.stringify(label)).join(", ")}`, ({ insert }) =>
		Effect.forEach(rows, insert, { discard: true }),
	);
}
