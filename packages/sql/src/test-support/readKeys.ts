import { type Cause, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import * as Statement from "effect/sql/Statement";
import { isComposite } from "@shivaedev/changes/compositeKeys.ts";
import { type BucketKey, collection, compositeId, type ItemKey, type Key } from "@shivaedev/changes/keys.ts";
import { ReadRecorder } from "@shivaedev/changes/readRecorder.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type MultiColumnKeyParameter, readSql } from "#readSql.ts";
import type { FindManyFilter, RepositoryListFilter } from "#repositoryFilter.ts";
import { type BucketRow, bucketRows } from "#test/bucketRows.ts";
import { compositeLedger } from "#test/compositeLedger.ts";
import { type DiaryEntry, diaryEntries } from "#test/diaryEntries.ts";
import { onPostgres } from "#test/engines.ts";
import { type OwnedRow, setupOwnedRows } from "#test/postgresOwnedRows.ts";

function keyWords(key: Key) {
	switch (key._tag) {
		case "List":
			return "the table";
		case "Item":
			return `record ${key.id}`;
		case "Bucket":
			return `${key.field} ${isComposite(key) ? key.value : JSON.stringify(key.value)}`;
	}
}

const engine = Effect.gen(function* () {
	return {
		buckets: yield* bucketRows,
		diary: yield* diaryEntries,
		ledger: yield* compositeLedger,
		owned: yield* setupOwnedRows,
		sql: yield* SqlClient.SqlClient,
	};
});

type Reading = Effect.Effect<void, SqlError | Schema.SchemaError | Cause.NoSuchElementError | MultiColumnKeyParameter>;

export type Read =
	| { readonly call: "findById"; readonly id: number }
	| { readonly call: "aggregate" | "count" | "findOne" | "select"; readonly where: FindManyFilter<typeof BucketRow> }
	| { readonly call: "findMany"; readonly where?: FindManyFilter<typeof BucketRow> }
	| { readonly call: "latestPerGroup"; readonly where: RepositoryListFilter<typeof BucketRow> }
	| { readonly call: "findDiaryEntries"; readonly where: FindManyFilter<typeof DiaryEntry> }
	| { readonly call: "findLedgerEntry"; readonly account: string; readonly sequence: bigint }
	| { readonly call: "findOwnedRow"; readonly id: number; readonly ownerId: number }
	| { readonly call: "findOwnedRows"; readonly where: FindManyFilter<typeof OwnedRow> }
	| { readonly call: "readSql"; readonly id: number; readonly owner: string }
	| { readonly call: "readSqlBySlug"; readonly key: MultiColumnKey };

export type MultiColumnKey = "a tuple bucket key" | "a composite row key";

const drafts = collection("drafts", Schema.String, {}, { ownerSlug: ["owner", "slug"] });
// Typed as plain keys, as a key that passed through a Key-typed value reaches readSql.
const multiColumnKeys: Readonly<Record<MultiColumnKey, BucketKey | ItemKey>> = {
	"a composite row key": drafts.item(compositeId(["alice", "draft"])),
	"a tuple bucket key": drafts.bucket.ownerSlug({ owner: "alice", slug: "draft" }),
};

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
			Effect.catchTag("MultiColumnKeyParameter", (refusal) => Effect.sync(() => log.push(`refuses: ${refusal.message}`))),
			Effect.orDie,
			Effect.as(log),
		);
	});
}

function perform({ buckets: { keys, rows, tableName }, diary, ledger, owned, sql }: Effect.Success<typeof engine>, read: Read): Reading {
	switch (read.call) {
		case "aggregate":
			return Effect.asVoid(rows.aggregate({ aggregates: { rows: { count: "*" } }, groupBy: ["owner"], where: read.where }));
		case "count":
			return Effect.asVoid(rows.count({ where: read.where }));
		case "findById":
			return Effect.asVoid(rows.findById(read.id));
		case "findDiaryEntries":
			return Effect.asVoid(diary.entries.findMany({ where: read.where }));
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
			return readSql`select id from ${sql(tableName)} where owner = ${keys.bucket.owner(read.owner)} or id = ${keys.item(read.id)}`.pipe(
				Effect.provideService(SqlClient.SqlClient, sql),
				Effect.asVoid,
			);
		case "readSqlBySlug":
			return readSql`select id from ${sql(tableName)} where slug = ${multiColumnKeys[read.key]}`.pipe(
				Effect.provideService(SqlClient.SqlClient, sql),
				Effect.asVoid,
			);
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
		case "readSqlBySlug":
			return `raw SQL rows by slug, marking ${read.key} as the slug parameter`;
		case "readSql":
			return `raw SQL rows of owner ${read.owner} or with id ${read.id}, marking the owner bucket and the row`;
		case "aggregate":
		case "count":
		case "findMany":
		case "findOne":
		case "findOwnedRows":
		case "findDiaryEntries":
		case "latestPerGroup":
		case "select":
			return read.where === undefined ? "without a filter" : `where ${JSON.stringify(read.where)}`;
	}
}
