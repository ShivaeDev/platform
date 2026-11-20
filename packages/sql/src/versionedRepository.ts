import { Effect, Option, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient, type SqlModel } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { PrimaryKey, Repository } from "#compositeRepository.ts";
import type { OptimisticConcurrencyError } from "#repository.ts";
import type { RepositoryChanges } from "#repositoryChanges.ts";
import type { Column, Columns, Selected, UpdateInput } from "#repositoryUpdate.ts";
import { sqlNameTransforms } from "#sqlNameTransforms.ts";
import { storageSchema } from "#storageSchema.ts";
import { type VersionedOptions, versionedStatements } from "#versionedStatements.ts";

export type IdColumn<TModel extends Model.Any> = keyof TModel["Type"] & keyof TModel["update"]["Type"] & keyof TModel["fields"];
export type VersionColumn<TModel extends Model.Any, TId extends PrimaryKey<TModel>> = {
	[TKey in Extract<keyof TModel["fields"] & keyof TModel["update"]["Type"], string>]: TModel["fields"][TKey] extends Schema.ConstraintCodec<
		number,
		number,
		never,
		never
	>
		? TModel["update"]["Type"] extends { readonly [TField in TKey]: number }
			? TKey
			: never
		: never;
}[Extract<keyof TModel["fields"] & keyof TModel["update"]["Type"], string>] &
	Exclude<keyof TModel["fields"], (TId extends readonly PropertyKey[] ? TId[number] : TId) | keyof TModel["insert"]["Type"]>;

export type NativeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>> = Effect.Success<
	ReturnType<typeof SqlModel.makeRepository<TModel, TId>>
>;
type WriteError = SqlError | Schema.SchemaError | OptimisticConcurrencyError;
type KeyColumn<TModel extends Model.Any, TId extends PrimaryKey<TModel>> = TId extends readonly IdColumn<TModel>[]
	? TId[number]
	: Extract<TId, IdColumn<TModel>>;
type RequiredColumn<TModel extends Model.Any, TId extends PrimaryKey<TModel>, TVersion extends PropertyKey> = KeyColumn<TModel, TId> | TVersion;
interface VersionedUpdate<
	TModel extends Model.Any,
	TId extends PrimaryKey<TModel>,
	TVersion extends VersionColumn<TModel, TId>,
	A,
	R = TModel["update"]["EncodingServices"] | TModel["DecodingServices"],
> {
	<TColumn extends Column<TModel, RequiredColumn<TModel, TId, TVersion>>>(
		input: Selected<TModel, RequiredColumn<TModel, TId, TVersion>, TColumn>,
		options: Columns<TColumn>,
	): Effect.Effect<A, WriteError, R>;
	(input: UpdateInput<TModel>): Effect.Effect<A, WriteError, R>;
}

export interface VersionedWrites<
	TModel extends Model.Any,
	TId extends PrimaryKey<TModel>,
	TVersion extends VersionColumn<TModel, TId> = VersionColumn<TModel, TId>,
> {
	readonly delete: (
		id: TId extends readonly IdColumn<TModel>[] ? Pick<TModel["Type"], TId[number]> : TModel["fields"][Extract<TId, IdColumn<TModel>>]["Type"],
		expectedVersion: number,
	) => Effect.Effect<void, WriteError, TModel["fields"][KeyColumn<TModel, TId>]["EncodingServices"]>;
	readonly insert: Repository<TModel, TId>["insert"];
	readonly insertVoid: Repository<TModel, TId>["insertVoid"];
	readonly update: VersionedUpdate<TModel, TId, TVersion, TModel["Type"]>;
	readonly updateVoid: VersionedUpdate<TModel, TId, TVersion, void, TModel["update"]["EncodingServices"]>;
}

export const makeVersionedWrites = Effect.fnUntraced(function* (
	model: Model.Any,
	options: VersionedOptions & { readonly changes: RepositoryChanges; readonly spanPrefix: string },
) {
	const sql = yield* SqlClient.SqlClient;
	const nameTransforms = yield* sqlNameTransforms;
	const { spanPrefix, changes } = options;
	const statements = yield* versionedStatements(model, options);
	const decodeRow = Schema.decodeUnknownEffect(storageSchema(model, model.fields, nameTransforms));
	function insert(input: unknown) {
		return Effect.gen(function* () {
			const statement = yield* statements.insert(input);
			const rows = yield* sql`${statement} returning ${changes.returning()}`;
			yield* changes.record(rows);
			return yield* decodeRow(rows[0]);
		}).pipe(changes.write, Effect.withSpan(`${spanPrefix}.insert`));
	}
	function insertVoid(input: unknown) {
		return Effect.gen(function* () {
			const statement = yield* statements.insert(input);
			const rows = yield* sql`${statement} returning ${changes.returning()}`;
			yield* changes.record(rows);
		}).pipe(changes.write, Effect.withSpan(`${spanPrefix}.insertVoid`));
	}
	function insertOrIgnore(input: unknown) {
		return Effect.gen(function* () {
			const statement = yield* statements.insert(input, true);
			const rows = yield* sql`${statement} returning ${changes.returning()}`;
			yield* changes.record(rows);
			return rows.length === 0 ? Option.none() : Option.some(yield* decodeRow(rows[0]));
		}).pipe(changes.write, Effect.withSpan(`${spanPrefix}.insertOrIgnore`));
	}
	function update(input: Readonly<Record<string, unknown>>, settings?: { readonly columns: readonly string[] }) {
		return Effect.gen(function* () {
			const { statement, classify } = yield* statements.update(input, settings?.columns);
			const rows = yield* sql`${statement} returning ${changes.returning()}`;
			if (rows.length === 0) {
				return yield* classify();
			}
			yield* changes.record(rows);
			return yield* decodeRow(rows[0]);
		}).pipe(changes.write, Effect.withSpan(`${spanPrefix}.update`));
	}
	function updateVoid(input: Readonly<Record<string, unknown>>, settings?: { readonly columns: readonly string[] }) {
		return Effect.gen(function* () {
			const { statement, classify } = yield* statements.update(input, settings?.columns);
			const rows = yield* sql`${statement} returning ${changes.returning()}`;
			if (rows.length === 0) {
				return yield* classify();
			}
			yield* changes.record(rows);
		}).pipe(changes.write, Effect.withSpan(`${spanPrefix}.updateVoid`));
	}
	function deleteRow(id: unknown, expected: number) {
		return Effect.gen(function* () {
			const { statement, classify } = yield* statements.remove(id, expected);
			const rows = yield* sql`${statement} returning ${changes.returning()}`;
			if (rows.length === 0) {
				return yield* classify();
			}
			yield* changes.record(rows);
		}).pipe(changes.write, Effect.withSpan(`${spanPrefix}.delete`));
	}
	return { delete: deleteRow, insert, insertVoid, update, updateVoid, ...(options.conflictColumns === undefined ? {} : { insertOrIgnore }) };
});
