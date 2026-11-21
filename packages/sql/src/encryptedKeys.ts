import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { declaredBuckets } from "@shivaedev/changes/buckets.ts";
import type { ColumnKey } from "#ColumnKey.ts";
import { EncryptedKeyError } from "#repositoryCollection.ts";
import { refuseServerOnlyKeys } from "#serverOnly.ts";

export const ENCRYPTED = "@shivaedev/sql/encrypted";

export function isEncrypted(field: Schema.Constraint) {
	return Schema.resolveAnnotations(field)?.[ENCRYPTED] === true;
}

// An encrypted field decodes with the column key, and its sealed bytes differ on every write, so no filter can name it.
type Sealed<TField> = TField extends { readonly DecodingServices: infer TServices }
	? unknown extends TServices
		? false
		: ColumnKey extends TServices
			? true
			: false
	: false;
export type Filterable<TModel extends Model.Any, TField> = TField extends keyof TModel["fields"]
	? Sealed<TModel["fields"][TField]> extends true
		? never
		: TField
	: TField;

// Every write seals a value under a fresh random nonce, so two equal values never share bytes and a column that must compare equal cannot hold one.
const refuseEncryptedKeys = Effect.fnUntraced(function* (
	table: string,
	columns: readonly string[],
	fields: Schema.Struct.Fields,
	tuples: Readonly<Record<string, readonly string[]>>,
) {
	const announced = [...new Set([...columns, ...declaredBuckets(fields).map(({ field }) => field), ...Object.values(tuples).flat()])];
	const refused = announced.filter((column) => {
		const schema = fields[column];
		return schema !== undefined && isEncrypted(schema);
	});
	if (refused.length > 0) {
		return yield* new EncryptedKeyError({ fields: refused, tableName: table });
	}
});

export const refuseKeyFields = Effect.fnUntraced(function* (
	table: string,
	fields: Schema.Struct.Fields,
	keys: {
		readonly conflictColumns: readonly string[] | undefined;
		readonly idColumns: readonly string[];
		readonly tuples: Readonly<Record<string, readonly string[]>> | undefined;
	},
) {
	yield* refuseServerOnlyKeys(table, keys.idColumns, fields, keys.tuples);
	yield* refuseEncryptedKeys(table, [...keys.idColumns, ...(keys.conflictColumns ?? [])], fields, keys.tuples ?? {});
});
