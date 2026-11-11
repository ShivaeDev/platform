import { Context, Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { command, query } from "#operation.ts";
import { signedIn } from "#readPolicy.ts";

export class StoredDiaryEntry extends Model.Class<StoredDiaryEntry>("LibraryDiaryEntry")({
	day: Schema.NullOr(Schema.Number),
	id: Schema.Number,
	note: Schema.String,
	ownerId: bucket(Schema.String),
}) {}
const entries = collection("library_diary", Schema.Number, { ownerId: Schema.String }, { ownerDay: ["ownerId", "day"] });

export const makeDiary = makeRepository(StoredDiaryEntry, {
	collection: entries,
	idColumn: "id",
	spanPrefix: "LibraryDiary",
	tableName: "library_diary",
});

export class Diary extends Context.Service<Diary, Effect.Success<typeof makeDiary>>()("@shivaedev/contract/test/Diary") {}

const Notes = Schema.mutable(Schema.Array(Schema.String));
const byId = { orderBy: { direction: "asc", field: "id" } } as const;

export const DiaryDay = query("diaryDay", {
	payload: { day: Schema.Number, ownerId: Schema.String },
	readPolicy: signedIn,
	*run({ day, ownerId }) {
		const diary = yield* Diary;
		return (yield* Effect.orDie(diary.findMany({ ...byId, where: { day, ownerId } }))).map(({ note }) => note);
	},
	success: Notes,
});
export const EveryDiaryEntry = query("everyDiaryEntry", {
	readPolicy: signedIn,
	*run() {
		const diary = yield* Diary;
		return (yield* Effect.orDie(diary.findMany(byId))).map(({ note }) => note);
	},
	success: Notes,
});
export const WriteDiary = command("writeDiary", {
	payload: { day: Schema.Number, id: Schema.Number, note: Schema.String, ownerId: Schema.String },
	*run(entry) {
		const diary = yield* Diary;
		yield* Effect.orDie(diary.insertVoid(entry));
	},
});

export const diaryMigration = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table library_diary (id integer primary key, "ownerId" text not null, day integer, note text not null)`;
	yield* sql`insert into library_diary values (1, 'alice', 1, 'rain'), (2, 'alice', 2, 'sun'), (3, 'bob', 1, 'fog')`;
});
