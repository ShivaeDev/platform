import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import * as Statement from "effect/sql/Statement";
import type { Key } from "@shivaedev/changes/keys.ts";
import { ReadRecorder } from "@shivaedev/changes/readRecorder.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
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

function observed<A, E, R>(read: Effect.Effect<A, E, R>) {
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

export const readKeys = storyKit({
	...onPostgres,
	create: () => engine,
	name: "keys that PostgreSQL repository reads record",
	stages: [],
	verbs: ({ buckets: { rows }, ledger, owned, sql }, story) => ({
		aggregate: (where: FindManyFilter<typeof BucketRow>) => {
			story.tell(`aggregate counts rows per owner where ${JSON.stringify(where)}`);
			return observed(rows.aggregate({ aggregates: { rows: { count: "*" } }, groupBy: ["owner"], where }));
		},
		count: (where: FindManyFilter<typeof BucketRow>) => {
			story.tell(`count reads where ${JSON.stringify(where)}`);
			return observed(rows.count({ where }));
		},
		findById: (id: number) => {
			story.tell(`findById reads row ${id}`);
			return observed(rows.findById(id));
		},
		findLedgerEntry: (account: string, sequence: bigint) => {
			story.tell(`findById reads the ${account} ledger entry at sequence ${sequence}`);
			return observed(ledger.entries.findById({ account, sequence }));
		},
		findMany: (where?: FindManyFilter<typeof BucketRow>) => {
			story.tell(where === undefined ? "findMany reads without a filter" : `findMany reads where ${JSON.stringify(where)}`);
			return observed(rows.findMany(where === undefined ? {} : { where }));
		},
		findOne: (where: FindManyFilter<typeof BucketRow>) => {
			story.tell(`findOne reads where ${JSON.stringify(where)}`);
			return observed(rows.findOne({ where }));
		},
		findOwnedRow: (id: number, ownerId: number) => {
			story.tell(`findById reads owned row ${id} of owner ${ownerId}, both stored as text`);
			return observed(owned.rows.findById({ id, ownerId }));
		},
		findOwnedRows: (where: FindManyFilter<typeof OwnedRow>) => {
			story.tell(`findMany reads owned rows where ${JSON.stringify(where)}`);
			return observed(owned.rows.findMany({ where }));
		},
		latestPerGroup: (where: RepositoryListFilter<typeof BucketRow>) => {
			story.tell(`latestPerGroup reads the newest row per list where ${JSON.stringify(where)}`);
			return observed(rows.latestPerGroup({ limit: 1, orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["listId"], where }));
		},
		select: (where: FindManyFilter<typeof BucketRow>) => {
			story.tell(`select builds a statement where ${JSON.stringify(where)}, which the caller runs`);
			return observed(Effect.flatMap(rows.select({ where }).statement, (statement) => sql`${statement}`));
		},
	}),
});
