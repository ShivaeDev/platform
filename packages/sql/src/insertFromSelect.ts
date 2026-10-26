import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";
import type { RepositoryChanges } from "#repositoryChanges.ts";
import type { RepositorySelect } from "#repositoryQueries.ts";

type CompatibleColumn<TType, TEncoded, TFields extends Schema.Struct.Fields> = {
	[TKey in keyof TFields]: TFields[TKey]["Type"] extends TType ? (TFields[TKey]["Encoded"] extends TEncoded ? TKey : never) : never;
}[keyof TFields] &
	string;

type ColumnMapping<TInput, TEncoded, TFields extends Schema.Struct.Fields> = {
	[TKey in keyof TInput]: CompatibleColumn<TInput[TKey], TEncoded[Extract<TKey, keyof TEncoded>], TFields>;
};

export type InsertFromSelect<TModel extends Model.Any, TServices = never> = <TFields extends Schema.Struct.Fields, TSourceServices>(
	source: RepositorySelect<TFields, TSourceServices>,
	columns: ColumnMapping<TModel["insert"]["Type"], TModel["insert"]["Encoded"], TFields>,
) => Effect.Effect<TModel["Type"][], SqlError | Schema.SchemaError, TSourceServices | TModel["DecodingServices"] | TServices>;

export interface SelectWrites<TModel extends Model.Any> {
	readonly insertFromSelect: InsertFromSelect<TModel>;
}

export function makeInsertFromSelect<TServices = never>(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: { readonly tableName: string; readonly spanPrefix: string; readonly changes: RepositoryChanges },
	operation: string,
	prepare: (columns: readonly string[]) => Effect.Effect<Fragment, Schema.SchemaError, TServices> = () => Effect.succeed(sql``),
) {
	const decode = Schema.decodeUnknownEffect(Schema.Array(model));
	return (source: RepositorySelect<Schema.Struct.Fields, unknown>, columns: Readonly<Record<string, string>>) =>
		Effect.gen(function* () {
			const names = Object.keys(columns);
			const selected = sql.csv(Object.values(columns).map((column) => sql`${sql(column)}`));
			const target = sql.csv(names.map((column) => sql`${sql(column)}`));
			const suffix = yield* prepare(names);
			const statement = yield* source.statement;
			const rows =
				yield* sql`insert into ${sql(options.tableName)} (${target}) select ${selected} from (${statement}) as ${sql("source")} where true ${suffix} returning *`;
			yield* options.changes.record(rows);
			return yield* decode(rows);
		}).pipe(options.changes.write, Effect.withSpan(`${options.spanPrefix}.${operation}`));
}
