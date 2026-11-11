import { type Cause, Effect, type Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import * as Statement from "effect/sql/Statement";
import type { Key } from "@shivaedev/changes/keys.ts";
import { ReadRecorder } from "@shivaedev/changes/readRecorder.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readSql } from "#readSql.ts";
import type { FindManyFilter, RepositoryListFilter } from "#repositoryFilter.ts";
import { type BucketRow, bucketRows } from "#test/bucketRows.ts";
import { compositeLedger } from "#test/compositeLedger.ts";
import { onPostgres } from "#test/engines.ts";
import { type OwnedRow, setupOwnedRows } from "#test/postgresOwnedRows.ts";

function keyWords(key: Key) {
	switch (key._tag) {
		case "List":
			return "the table";
		case "Item":
			return `record ${key.id}`;
		case "Bucket":
			return `${key.field} ${JSON.stringify(key.value)}`;
	}
}

const engine = Effect.gen(function* () {
	return { buckets: yield* bucketRows, ledger: yield* compositeLedger, owned: yield* setupOwnedRows, sql: yield* SqlClient.SqlClient };
});

type Reading = Effect.Effect<void, SqlError | Schema.SchemaError | Cause.NoSuchElementError>;

export type Read =
	| { readonly call: "findById"; readonly id: number }
	| { readonly call: "aggregate" | "count" | "findOne" | "select"; readonly where: FindManyFilter<typeof BucketRow> }
	| { readonly call: "findMany"; readonly where?: FindManyFilter<typeof BucketRow> }
	| { readonly call: "latestPerGroup"; readonly where: RepositoryListFilter<typeof BucketRow> }
	| { readonly call: "findLedgerEntry"; readonly account: string; readonly sequence: bigint }
	| { readonly call: "findOwnedRow"; readonly id: number; readonly ownerId: number }
	| { readonly call: "findOwnedRows"; readonly where: FindManyFilter<typeof OwnedRow> }
	| { readonly call: "readSql"; readonly id: number; readonly owner: string };

function observed(read: Reading) {
	return Effect.suspend(() => {
		const log: string[] = [];
		return read.pipe(
			Effect.provideService(ReadRecorder, (keys) =>
				Effect.sync(() => {
					log.push(keys.length === 0 ? "listens on nothing" : `listens on ${keys.map(keyWords).join(", ")}`);
				}),
			),
			Effect.provideService(Statement.CurrentTransformer, (statement) =>
				Effect.sync(() => {
					log.push("sends its statement");
					return statement;
				}),
			),
			Effect.catchTag("NoSuchElementError", () => Effect.void),
			Effect.orDie,
			Effect.as(log),
		);
	});
}

function perform({ buckets: { keys, rows, tableName }, ledger, owned, sql }: Effect.Success<typeof engine>, read: Read): Reading {
	switch (read.call) {
		case "aggregate":
			return Effect.asVoid(rows.aggregate({ aggregates: { rows: { count: "*" } }, groupBy: ["owner"], where: read.where }));
		case "count":
			return Effect.asVoid(rows.count({ where: read.where }));
		case "findById":
			return Effect.asVoid(rows.findById(read.id));
		case "findLedgerEntry":
			return Effect.asVoid(ledger.entries.findById({ account: read.account, sequence: read.sequence }));
		case "findMany":
			return Effect.asVoid(rows.findMany(read.where === undefined ? {} : { where: read.where }));
		case "findOne":
			return Effect.asVoid(rows.findOne({ where: read.where }));
		case "findOwnedRow":
			return Effect.asVoid(owned.rows.findById({ id: read.id, ownerId: read.ownerId }));
		case "findOwnedRows":
			return Effect.asVoid(owned.rows.findMany({ where: read.where }));
		case "latestPerGroup":
			return Effect.asVoid(
				rows.latestPerGroup({ limit: 1, orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["listId"], where: read.where }),
			);
		case "readSql":
			return Effect.asVoid(readSql`select id from ${sql(tableName)} where owner = ${keys.bucket.owner(read.owner)} or id = ${keys.item(read.id)}`);
		case "select":
			return Effect.asVoid(Effect.flatMap(rows.select({ where: read.where }).statement, (statement) => sql`${statement}`));
	}
}

export const readKeys = storyKit({
	...onPostgres,
	create: () => engine,
	name: "keys that PostgreSQL repository and raw SQL reads record",
	stages: [],
	verbs: (current, story) => ({
		read: (read: Read) => {
			story.tell(`${read.call} reads ${described(read)}`);
			return observed(perform(current, read));
		},
	}),
});

function described(read: Read) {
	switch (read.call) {
		case "findById":
			return `row ${read.id}`;
		case "findLedgerEntry":
			return `the ${read.account} ledger entry at sequence ${read.sequence}, a composite id with a bigint`;
		case "findOwnedRow":
			return `owned row ${read.id} of owner ${read.ownerId}, a composite id stored as text`;
		case "readSql":
			return `raw SQL rows of owner ${read.owner} or with id ${read.id}, marking the owner bucket and the row`;
		case "aggregate":
		case "count":
		case "findMany":
		case "findOne":
		case "findOwnedRows":
		case "latestPerGroup":
		case "select":
			return read.where === undefined ? "without a filter" : `where ${JSON.stringify(read.where)}`;
	}
}
