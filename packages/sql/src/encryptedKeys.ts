import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { declaredBuckets } from "@shivaedev/changes/buckets.ts";
import { ColumnKey, type ColumnKeyError } from "#ColumnKey.ts";
import { EncryptedKeyError, type RepositoryBuildError } from "#repositoryCollection.ts";
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

// A model with an encrypted field needs the column key on every read and write, so its repository loads the key while it is built and a host refuses to start without it.
type HasSealed<TModel extends Model.Any> = true extends {
	[TField in keyof TModel["fields"]]: Sealed<TModel["fields"][TField]>;
}[keyof TModel["fields"]]
	? true
	: false;
export type RepositoryBuild<TModel extends Model.Any, TShape> = Effect.Effect<
	TShape,
	RepositoryBuildError | (HasSealed<TModel> extends true ? ColumnKeyError : never),
	SqlClient.SqlClient | (HasSealed<TModel> extends true ? ColumnKey : never)
>;

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

export const loadColumnKeyFor = Effect.fnUntraced(function* (fields: Schema.Struct.Fields) {
	if (Object.values(fields).some(isEncrypted)) {
		yield* yield* ColumnKey;
	}
});
