import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "#repository.ts";

export class BucketRow extends Model.Class<BucketRow>("BucketRow")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	listId: bucket(Schema.NullOr(Schema.NumberFromString)),
	owner: bucket(Schema.String),
	slug: Schema.String,
	version: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
}) {}

export const bucketRows = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `bucket_rows_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id integer generated always as identity primary key,
		"listId" text, owner text not null, slug text unique not null, version integer not null default 0)`,
		() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
	);
	const sourceTable = `${tableName}_source`;
	yield* Effect.acquireRelease(sql`create table ${sql(sourceTable)} (like ${sql(tableName)} including all)`, () =>
		sql`drop table ${sql(sourceTable)}`.pipe(Effect.orDie),
	);
	const options = { conflictColumns: ["slug"], idColumn: "id", spanPrefix: "Buckets", tableName } as const;
	const rows = yield* makeRepository(BucketRow, options);
	const source = yield* makeRepository(BucketRow, { ...options, tableName: sourceTable });
	const versioned = yield* makeRepository(BucketRow, { ...options, versionColumn: "version" });
	const keys = collection(tableName, Schema.Number, { listId: Schema.Number, owner: Schema.String });
	return { keys, rows, source, tableName, versioned };
});
