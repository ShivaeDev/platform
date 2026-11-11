import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { type BucketKey, type ItemKey, Key } from "@shivaedev/changes/keys.ts";
import { recordRead } from "@shivaedev/changes/readRecorder.ts";

const isKey = Schema.is(Key);

function isReadKey(value: unknown): value is BucketKey | ItemKey {
	return isKey(value) && value._tag !== "List";
}

function bound(value: unknown) {
	if (!isReadKey(value)) {
		return value;
	}
	return value._tag === "Bucket" ? value.value : value.id;
}

export const readSql = Effect.fn("Sql.readSql")(function* (strings: TemplateStringsArray, ...args: readonly unknown[]) {
	const sql = yield* SqlClient.SqlClient;
	yield* recordRead(args.filter(isReadKey), { inferred: true });
	return yield* sql(strings, ...args.map(bound));
});
