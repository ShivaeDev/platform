import { Data, Effect, type Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { makeBatchedDelete } from "#batchedDelete.ts";
import { type BatchWrites, makeInsertMany } from "#batchWrites.ts";
import { makeCompositeCrud, type PrimaryKey, type Repository } from "#compositeRepository.ts";
import { type ConflictColumns, type ConflictWrites, makeConflictWrites } from "#conflictWrites.ts";
import { makeInsertFromSelect, type SelectWrites } from "#insertFromSelect.ts";
import { repositoryChanges } from "#repositoryChanges.ts";
import { type BucketRegistrationError, type RepositoryOptions, validateRepositoryCollection } from "#repositoryCollection.ts";
import type { FindManyFilter, RepositoryFilter, RepositoryListFilter } from "#repositoryFilter.ts";
import { makeQueries, type Queries } from "#repositoryQueries.ts";
import type { VersionedRepositoryShape } from "#VersionedRepositoryShape.ts";
import { type IdColumn, makeVersionedWrites, type VersionColumn } from "#versionedRepository.ts";

type Key<TModel extends Model.Any> = Extract<keyof TModel["fields"] & keyof Row<TModel>, string>;
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;

export interface OrderBy<TModel extends Model.Any> {
	readonly direction: "asc" | "desc";
	readonly field: Key<TModel>;
}

export interface FindMany<TModel extends Model.Any, TKey extends Key<TModel>> {
	readonly limit?: number;
	readonly orderBy?: OrderBy<TModel> | readonly [OrderBy<TModel>, ...OrderBy<TModel>[]];
	readonly select?: readonly [TKey, ...TKey[]];
	readonly where?: FindManyFilter<TModel>;
}

export type FindOne<TModel extends Model.Any, TKey extends Key<TModel>> = Omit<FindMany<TModel, TKey>, "limit">;

export interface LatestPerGroup<TModel extends Model.Any> {
	readonly limit: number;
	readonly orderBy: readonly [OrderBy<TModel>, ...OrderBy<TModel>[]];
	readonly partitionBy: readonly [Key<TModel>, ...Key<TModel>[]];
	readonly where?: RepositoryListFilter<TModel>;
}

export class OptimisticConcurrencyError extends Data.TaggedError("OptimisticConcurrencyError")<{
	readonly tableName: string;
	readonly id: unknown;
	readonly expectedVersion: number;
	readonly reason: "missing" | "stale";
}> {}

export function makeRepository<
	TModel extends Model.Any,
	const TId extends PrimaryKey<TModel>,
	const TConflict extends ConflictColumns<TModel>,
	const TWhere extends keyof RepositoryFilter<TModel> = never,
	const TVersion extends VersionColumn<TModel, TId> = VersionColumn<TModel, TId>,
>(
	model: TModel,
	options: RepositoryOptions<TId> & {
		readonly versionColumn: TVersion;
		readonly conflictColumns: TConflict;
		readonly conflictWhere?: Pick<RepositoryFilter<TModel>, TWhere>;
	},
): Effect.Effect<
	VersionedRepositoryShape<TModel, TId, TVersion> &
		Pick<ConflictWrites<TModel, never, TModel["fields"][Extract<TWhere, keyof TModel["fields"]>]["EncodingServices"]>, "insertOrIgnore">,
	BucketRegistrationError,
	SqlClient.SqlClient
>;
export function makeRepository<
	TModel extends Model.Any,
	const TId extends PrimaryKey<TModel>,
	const TVersion extends VersionColumn<TModel, TId> = VersionColumn<TModel, TId>,
>(
	model: TModel,
	options: RepositoryOptions<TId> & {
		readonly versionColumn: TVersion;
		readonly conflictColumns?: never;
		readonly conflictWhere?: never;
	},
): Effect.Effect<VersionedRepositoryShape<TModel, TId, TVersion>, BucketRegistrationError, SqlClient.SqlClient>;
export function makeRepository<
	TModel extends Model.Any,
	const TId extends PrimaryKey<TModel>,
	const TConflict extends ConflictColumns<TModel>,
	const TWhere extends keyof RepositoryFilter<TModel> = never,
>(
	model: TModel,
	options: RepositoryOptions<TId> & {
		readonly versionColumn?: never;
		readonly conflictColumns: TConflict;
		readonly conflictWhere?: Pick<RepositoryFilter<TModel>, TWhere>;
	},
): Effect.Effect<
	Repository<TModel, TId> &
		BatchWrites<TModel> &
		SelectWrites<TModel> &
		Queries<TModel> &
		ConflictWrites<
			TModel,
			TConflict[number] | (TId extends readonly PropertyKey[] ? TId[number] : TId),
			TModel["fields"][Extract<TWhere, keyof TModel["fields"]>]["EncodingServices"]
		>,
	BucketRegistrationError,
	SqlClient.SqlClient
>;
export function makeRepository<TModel extends Model.Any, const TId extends PrimaryKey<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & { readonly versionColumn?: never; readonly conflictColumns?: never; readonly conflictWhere?: never },
): Effect.Effect<
	Repository<TModel, TId> & BatchWrites<TModel> & SelectWrites<TModel> & Queries<TModel>,
	BucketRegistrationError,
	SqlClient.SqlClient
>;
export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId | readonly [TId, TId, ...TId[]]> & {
		readonly versionColumn?: string;
		readonly conflictColumns?: readonly string[];
		readonly conflictWhere?: Readonly<Record<string, unknown>>;
	},
): Effect.Effect<unknown, BucketRegistrationError, SqlClient.SqlClient> {
	return Effect.fnUntraced(function* () {
		yield* validateRepositoryCollection(model.fields, options);
		const composite = typeof options.idColumn === "object";
		const idColumns = (composite ? options.idColumn : [options.idColumn]).map(String);
		const changes = yield* repositoryChanges(options.tableName, idColumns, model.fields);
		const crud = {
			...(yield* makeCompositeCrud(model, { ...options, columns: idColumns }, changes)),
			deleteBatched: yield* makeBatchedDelete(model, options, changes),
		};
		const queries = yield* makeQueries(model, options);
		return {
			...crud,
			...queries,
			...(options.versionColumn === undefined
				? {
						insertFromSelect: yield* makeInsertFromSelect(model, { ...options, changes }, "insertFromSelect"),
						insertMany: yield* makeInsertMany(model, { ...options, changes }, "insertMany"),
						...(options.conflictColumns === undefined
							? {}
							: yield* makeConflictWrites(model, { ...options, changes, conflictColumns: options.conflictColumns, idColumns })),
					}
				: yield* makeVersionedWrites(model, {
						...options,
						changes,
						conflict: (id, expectedVersion, reason) => new OptimisticConcurrencyError({ expectedVersion, id, reason, tableName: options.tableName }),
						idColumns,
						versionColumn: options.versionColumn,
					})),
		};
	})();
}
