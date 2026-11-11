import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "#repository.ts";

export class DiaryEntry extends Model.Class<DiaryEntry>("DiaryEntry")({
	day: Schema.NullOr(Schema.Number),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	note: Schema.String,
	ownerId: bucket(Schema.String),
}) {}

function diaryKeys(tableName: string) {
	return collection(tableName, Schema.Number, { ownerId: Schema.String }, { ownerDay: ["ownerId", "day"] });
}

export const diaryEntries = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `diary_entries_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id integer generated always as identity primary key, "ownerId" text not null, day integer, note text not null)`,
		() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
	);
	const keys = diaryKeys(tableName);
	const entries = yield* makeRepository(DiaryEntry, { collection: keys, idColumn: "id", spanPrefix: "DiaryEntries", tableName });
	return { entries, keys, tableName };
});
