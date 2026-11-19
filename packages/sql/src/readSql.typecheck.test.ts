import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Row } from "effect/sql/SqlConnection";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { type BucketKey, collection, compositeId, type ItemKey, type Key } from "@shivaedev/changes/keys.ts";
import { type MultiColumnKeyParameter, readSql } from "#readSql.ts";

const entries = collection("entries", Schema.Number, { ownerId: Schema.String }, { ownerDay: ["ownerId", "day"] });
const ledger = collection("ledger", Schema.String);

const singleColumn = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	return yield* readSql`select id from ${sql("entries")} where owner_id = ${entries.bucket.ownerId("alice")} or id = ${entries.item(1)} limit ${10}`;
});
expectTypeOf(singleColumn).toEqualTypeOf<Effect.Effect<readonly Row[], SqlError, SqlClient.SqlClient>>();

expectTypeOf(readSql`select id from ledger where label = ${"cash"}`).toEqualTypeOf<Effect.Effect<readonly Row[], SqlError, SqlClient.SqlClient>>();

declare const accountId: string;
declare const bucketKey: BucketKey;
declare const itemKey: ItemKey;
declare const key: Key;
declare const value: unknown;
type MayRefuse = Effect.Effect<readonly Row[], SqlError | MultiColumnKeyParameter, SqlClient.SqlClient>;
// A string id spelled as compositeId spells several values is marked composite at runtime.
expectTypeOf(readSql`select id from ledger where id = ${ledger.item(accountId)}`).toEqualTypeOf<MayRefuse>();
// A plain key type may hold a widened tuple bucket or composite row key.
expectTypeOf(readSql`select id from entries where owner_id = ${bucketKey}`).toEqualTypeOf<MayRefuse>();
expectTypeOf(readSql`select id from entries where id = ${itemKey}`).toEqualTypeOf<MayRefuse>();
expectTypeOf(readSql`select id from entries where id = ${key}`).toEqualTypeOf<MayRefuse>();
expectTypeOf(readSql`select id from entries where id = ${value}`).toEqualTypeOf<MayRefuse>();
expectTypeOf(readSql`select id from entries where owner_id = ${entries.bucket.ownerId("alice")} or id = ${itemKey}`).toEqualTypeOf<MayRefuse>();

// @ts-expect-error A tuple bucket key spans several columns, so it cannot be one parameter.
expectTypeOf(readSql`select id from entries where owner_id = ${entries.bucket.ownerDay({ day: 1, ownerId: "alice" })}`).toBeObject();
// @ts-expect-error A composite row key spans several columns, so it cannot be one parameter.
expectTypeOf(readSql`select id from ledger where id = ${ledger.item(compositeId(["cash", 1]))}`).toBeObject();

// @ts-expect-error A single-column read cannot fail with MultiColumnKeyParameter, so there is nothing to catch.
Effect.catchTag(readSql`select id from entries where owner_id = ${entries.bucket.ownerId("alice")}`, "MultiColumnKeyParameter", () =>
	Effect.succeed([]),
);
