import { type Cause, Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient, SqlSchema } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { storageSchema } from "#adapters/storageSchema.ts";
import { type ChildOrderError, orderedChildStatements } from "#orderedChildStatements.ts";
import { repositoryChanges } from "#repositoryChanges.ts";
import { sqlNameTransforms } from "#sqlNameTransforms.ts";
import type { IdColumn, VersionColumn } from "#versionedRepository.ts";

type Column<TModel extends Model.Any> = Extract<keyof TModel["fields"] & keyof TModel["insert"]["Type"], string>;
type Position<TModel extends Model.Any> = {
	[TKey in Column<TModel>]: TModel["fields"][TKey] extends Schema.ConstraintCodec<number, number, never, never> ? TKey : never;
}[Column<TModel>];

export const makeOrderedChildren = Effect.fn("Sql.makeOrderedChildren")(function* <
	TModel extends Model.Any,
	const TId extends Extract<IdColumn<TModel>, string>,
	const TParent extends Column<TModel>,
	const TPosition extends Position<TModel>,
>(
	model: TModel,
	options: {
		readonly idColumn: TId;
		readonly parentColumn: TParent;
		readonly parentTable: string;
		readonly parentIdColumn: string;
		readonly positionColumn: TPosition;
		readonly spanPrefix: string;
		readonly tableName: string;
		readonly versionColumn?: VersionColumn<TModel, TId>;
	},
) {
	const sql = yield* SqlClient.SqlClient;
	const nameTransforms = yield* sqlNameTransforms;
	const changes = yield* repositoryChanges(options.tableName, [options.idColumn], model.fields);
	const statements = yield* orderedChildStatements(model, options, changes);
	const encode = Schema.encodeEffect(storageSchema(model.insert, model.fields, nameTransforms));
	const decode = Schema.decodeUnknownEffect(storageSchema(model, model.fields, nameTransforms));
	const { parentColumn, positionColumn, versionColumn, tableName, spanPrefix } = options;
	function append(
		parent: TModel["fields"][TParent]["Type"],
		input: Omit<TModel["insert"]["Type"], TParent | TPosition>,
	): Effect.Effect<
		TModel["Type"],
		SqlError | Schema.SchemaError | Cause.NoSuchElementError,
		TModel["insert"]["EncodingServices"] | TModel["DecodingServices"]
	> {
		return Effect.gen(function* () {
			const encodedParent = yield* statements.lock(parent);
			const last = yield* SqlSchema.findOne({
				execute: (value) =>
					sql`select coalesce(max(${sql(positionColumn)}) + 1, 0)::integer as next from ${sql(tableName)} where ${sql(parentColumn)} = ${value}`,
				Request: Schema.Unknown,
				Result: Schema.Struct({ next: Schema.Int }),
			})(encodedParent);
			const encoded = yield* encode({ ...input, [parentColumn]: parent, [positionColumn]: last.next });
			const row = versionColumn === undefined ? encoded : { ...encoded, [versionColumn]: 0 };
			const rows = yield* sql`insert into ${sql(tableName)} ${sql.insert(row)} returning ${changes.returning()}`;
			yield* changes.record(rows);
			return yield* decode(rows[0]);
		}).pipe(changes.write, Effect.withSpan(`${spanPrefix}.append`));
	}
	type OrderResult = Effect.Effect<
		void,
		SqlError | Schema.SchemaError | Cause.NoSuchElementError | ChildOrderError,
		TModel["fields"][TParent | TId]["EncodingServices"] | TModel["fields"][TId]["DecodingServices"]
	>;
	function move(parent: TModel["fields"][TParent]["Type"], id: TModel["fields"][TId]["Type"], position: number): OrderResult;
	function move(parent: unknown, id: unknown, position: number) {
		return statements.move(parent, id, position).pipe(changes.write, Effect.withSpan(`${spanPrefix}.move`));
	}
	function reorder(parent: TModel["fields"][TParent]["Type"], ids: readonly TModel["fields"][TId]["Type"][]): OrderResult;
	function reorder(parent: unknown, ids: readonly unknown[]) {
		return statements.reorder(parent, ids).pipe(changes.write, Effect.withSpan(`${spanPrefix}.reorder`));
	}
	return { append, move, reorder };
});
