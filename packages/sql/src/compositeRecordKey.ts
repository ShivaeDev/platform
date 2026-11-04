import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { compositeId, recordKey } from "@shivaedev/changes/keys.ts";
import type { CompositeKey } from "#compositeRepository.ts";

export function compositeRecordKey<TModel extends Model.Any, const TColumns extends CompositeKey<TModel>>(
	model: TModel,
	options: { readonly tableName: string; readonly idColumn: TColumns },
	value: Pick<Schema.Struct.Type<TModel["fields"]>, TColumns[number]>,
): Effect.Effect<string, Schema.SchemaError, TModel["fields"][TColumns[number]]["EncodingServices"]>;
export function compositeRecordKey(
	model: Model.Any,
	options: { readonly tableName: string; readonly idColumn: readonly string[] },
	value: Readonly<Record<string, unknown>>,
): Effect.Effect<string, Schema.SchemaError, unknown> {
	return Effect.fn("Sql.compositeRecordKey")(function* () {
		const fields = Object.fromEntries(Object.entries(model.fields).filter(([column]) => options.idColumn.includes(column)));
		const encoded = yield* Schema.encodeUnknownEffect(Schema.Struct(fields))(value);
		const values = options.idColumn.map((column) => {
			const stored = encoded[column];
			return PgTypes.isParameter(stored) ? stored.value : stored;
		});
		return recordKey(options.tableName, compositeId(values));
	})();
}
