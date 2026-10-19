import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";
import type { RepositoryChanges } from "./repositoryChanges.ts";

export type InsertMany<TModel extends Model.Any, TServices = never> = (
	inputs: readonly TModel["insert"]["Type"][],
) => Effect.Effect<TModel["Type"][], SqlError | Schema.SchemaError, TModel["insert"]["EncodingServices"] | TModel["DecodingServices"] | TServices>;

export interface BatchWrites<TModel extends Model.Any> {
	readonly insertMany: InsertMany<TModel>;
}

export function makeInsertMany<TServices = never>(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: { readonly tableName: string; readonly spanPrefix: string; readonly changes: RepositoryChanges },
	operation: string,
	prepare: (row: Readonly<Record<string, unknown>>) => Effect.Effect<Fragment, Schema.SchemaError, TServices> = () => Effect.succeed(sql``),
) {
	const encode = Schema.encodeEffect(model.insert);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const decode = Schema.decodeUnknownEffect(Schema.Array(model));
	return (inputs: readonly unknown[]) =>
		Effect.gen(function* () {
			if (inputs.length === 0) {
				return [];
			}
			const rows = yield* Effect.forEach(inputs, (input) => Effect.flatMap(encode(input), record));
			const columns = [...new Set(rows.flatMap(Object.keys))];
			if (columns.length === 0) {
				columns.push(...Object.keys(model.fields).slice(0, 1));
			}
			const names = sql.csv(columns.map((column) => sql`${sql(column)}`));
			const chunkSize = Math.max(1, Math.min(1000, Math.floor(10_000 / columns.length)));
			const results: unknown[] = [];
			let chunk: Fragment[] = [];
			let parameters = 0;
			let suffix: Fragment = sql``;
			const flush = Effect.gen(function* () {
				const returned = yield* sql`insert into ${sql(options.tableName)} (${names}) values ${sql.csv(chunk)} ${suffix} returning *`;
				yield* options.changes.record(returned);
				for (const row of yield* decode(returned)) {
					results.push(row);
				}
				chunk = [];
				parameters = 0;
			});
			for (const row of rows) {
				const value = sql`(${sql.csv(columns.map((column) => (Object.hasOwn(row, column) ? sql`${row[column]}` : sql`default`)))})`;
				const size = value.compile()[1].length;
				const prepared = yield* prepare(row);
				const suffixSize = sql`${prepared}`.compile()[1].length;
				// Bound native fragment size as well as PostgreSQL's 65,535 bind parameters.
				if (chunk.length > 0 && (chunk.length === chunkSize || parameters + size + suffixSize > 10_000)) {
					yield* flush;
				}
				suffix = prepared;
				chunk.push(value);
				parameters += size;
			}
			yield* flush;
			return results;
		}).pipe(options.changes.write, Effect.withSpan(`${options.spanPrefix}.${operation}`));
}
