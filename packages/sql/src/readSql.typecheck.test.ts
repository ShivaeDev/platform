import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { collection, compositeId } from "@shivaedev/changes/keys.ts";
import { type MultiColumnKeyParameter, readSql } from "#readSql.ts";

const entries = collection("entries", Schema.Number, { ownerId: Schema.String }, { ownerDay: ["ownerId", "day"] });
const ledger = collection("ledger", Schema.String);

const marked = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	return yield* readSql`select id from ${sql("entries")} where owner_id = ${entries.bucket.ownerId("alice")} or id = ${entries.item(1)}`;
});
expectTypeOf(marked).toEqualTypeOf<
	Effect.Effect<readonly { readonly [column: string]: unknown }[], SqlError | MultiColumnKeyParameter, SqlClient.SqlClient>
>();

// @ts-expect-error A tuple bucket key spans several columns, so it cannot be one parameter.
expectTypeOf(readSql`select id from entries where owner_id = ${entries.bucket.ownerDay({ day: 1, ownerId: "alice" })}`).toBeObject();
// @ts-expect-error A composite row key spans several columns, so it cannot be one parameter.
expectTypeOf(readSql`select id from ledger where id = ${ledger.item(compositeId(["cash", 1]))}`).toBeObject();
